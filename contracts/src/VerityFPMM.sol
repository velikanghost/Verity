// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ConditionalTokenVault} from "./ConditionalTokenVault.sol";

interface IVerityMarketFactory {
    function escrowBalances(bytes32 marketId) external view returns (uint256);

    function claimPreMarketDeposit(
        bytes32 marketId,
        address user
    ) external returns (uint256);

    function marketRegistry(
        bytes32 marketId
    )
        external
        view
        returns (
            address creator,
            uint256 deadline,
            uint256 fundingDeadline,
            bool registered,
            bool funded,
            bool resolved,
            bool voided
        );
}

/// @title VerityFPMM
/// @notice Fixed Product Market Maker for Verity prediction markets.
///         One contract manages all AMM pools. No per-market deployments.
contract VerityFPMM is ERC1155Holder {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant PRECISION = 1e18; // For price calculations

    // ─── State ───────────────────────────────────────────────────────────
    ConditionalTokenVault public immutable VAULT;
    IERC20 public immutable USDC;
    address public admin;
    address public factory; // Authorized VerityMarketFactory
    address public treasury; // Verity protocol treasury for 40% fees

    // ─── Config State Variables ──────────────────────────────────────────
    uint256 public feeBps;
    uint256 public lpFeeShare;
    uint256 public treasuryFeeShare;
    uint256 public minPoolBalance;
    uint256 public creatorMinLock;
    uint256 public lpLockDuration;

    struct Pool {
        uint256 yesBalance;
        uint256 noBalance;
        uint256[] outcomeBalances;
        uint256 totalLpShares;
        uint256 creatorShares;
        address creator;
        uint256 collectedFeesLp;
        uint256 collectedFeesTreasury;
        uint256 totalDeposited;
        bool active; // true once totalDeposited >= minPoolBalance
        bool resolved;
    }

    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => mapping(address => uint256)) public lpShares;
    mapping(bytes32 => mapping(address => uint256)) public lpDepositTime;

    // ─── Events ──────────────────────────────────────────────────────────
    event PoolCreated(
        bytes32 indexed marketId,
        address indexed creator,
        uint256 initialUsdc
    );
    event PoolActivated(bytes32 indexed marketId, uint256 totalDeposited);
    event LiquidityAdded(
        bytes32 indexed marketId,
        address indexed provider,
        uint256 usdcAmount,
        uint256 sharesMinted
    );
    event LiquidityRemoved(
        bytes32 indexed marketId,
        address indexed provider,
        uint256 sharesBurned,
        uint256 yesOut,
        uint256 noOut
    );
    event TokensBought(
        bytes32 indexed marketId,
        address indexed buyer,
        bool isYes,
        uint256 usdcIn,
        uint256 tokensOut,
        uint256 fee
    );
    event TokensSold(
        bytes32 indexed marketId,
        address indexed seller,
        bool isYes,
        uint256 tokensIn,
        uint256 usdcOut,
        uint256 fee
    );
    event CreatorLiquidityClaimed(
        bytes32 indexed marketId,
        address indexed creator,
        uint256 yesOut,
        uint256 noOut
    );
    event FeesWithdrawn(bytes32 indexed marketId, uint256 treasuryAmount);
    event PreMarketLPSharesClaimed(
        bytes32 indexed marketId,
        address indexed lp,
        uint256 amount
    );
    event FeeBpsUpdated(uint256 newFeeBps);
    event FeeSharesUpdated(uint256 newLpShare, uint256 newTreasuryShare);
    event PoolLimitsUpdated(
        uint256 newMinPoolBalance,
        uint256 newCreatorMinLock
    );
    event LpLockDurationUpdated(uint256 newDuration);

    // ─── Errors ──────────────────────────────────────────────────────────
    error Unauthorized();
    error PoolAlreadyExists();
    error PoolNotActive();
    error PoolNotResolved();
    error InsufficientDeposit();
    error InsufficientShares();
    error InsufficientBalance();
    error LPLockActive();
    error CreatorCannotWithdraw();
    error ZeroAmount();
    error NotCreator();
    error InvalidPool();
    error InvalidValue();

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyFactory() {
        _onlyFactory();
        _;
    }

    function _onlyFactory() internal view {
        if (msg.sender != factory) revert Unauthorized();
    }

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    function _onlyAdmin() internal view {
        if (msg.sender != admin) revert Unauthorized();
    }

    modifier poolMustBeActive(bytes32 marketId) {
        _poolMustBeActive(marketId);
        _;
    }

    function _poolMustBeActive(bytes32 marketId) internal view {
        if (!pools[marketId].active) revert PoolNotActive();
        if (pools[marketId].resolved) revert PoolNotActive();
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _vault, address _usdc, address _treasury) {
        VAULT = ConditionalTokenVault(_vault);
        USDC = IERC20(_usdc);
        treasury = _treasury;
        admin = msg.sender;

        // Initialize default configurations
        feeBps = 200;
        lpFeeShare = 60;
        treasuryFeeShare = 40;
        minPoolBalance = 20e6;
        creatorMinLock = 5e6;
        lpLockDuration = 24 hours;
    }

    // ─── Admin Setup ─────────────────────────────────────────────────────
    function setFactory(address _factory) external onlyAdmin {
        factory = _factory;
    }

    function setTreasury(address _treasury) external onlyAdmin {
        treasury = _treasury;
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    function setFeeBps(uint256 _feeBps) external onlyAdmin {
        if (_feeBps > 500) revert InvalidValue(); // Cap trading fee at 5%
        feeBps = _feeBps;
        emit FeeBpsUpdated(_feeBps);
    }

    function setFeeShares(
        uint256 _lpFeeShare,
        uint256 _treasuryFeeShare
    ) external onlyAdmin {
        if (_lpFeeShare + _treasuryFeeShare != 100) revert InvalidValue();
        lpFeeShare = _lpFeeShare;
        treasuryFeeShare = _treasuryFeeShare;
        emit FeeSharesUpdated(_lpFeeShare, _treasuryFeeShare);
    }

    function setPoolLimits(
        uint256 _minPoolBalance,
        uint256 _creatorMinLock
    ) external onlyAdmin {
        minPoolBalance = _minPoolBalance;
        creatorMinLock = _creatorMinLock;
        emit PoolLimitsUpdated(_minPoolBalance, _creatorMinLock);
    }

    function setLpLockDuration(uint256 _duration) external onlyAdmin {
        if (_duration > 3 days) revert InvalidValue(); // Cap LP lock-up at 3 days
        lpLockDuration = _duration;
        emit LpLockDurationUpdated(_duration);
    }

    // ─── Pool Creation (called by Factory) ───────────────────────────────

    /// @notice Creates the pool after the escrow threshold is reached.
    /// @param marketId Market identifier (bytes32)
    function createPool(bytes32 marketId) external onlyFactory {
        createPool(marketId, 0);
    }

    function createPool(
        bytes32 marketId,
        uint256 outcomeCount
    ) public onlyFactory {
        if (pools[marketId].creator != address(0)) revert PoolAlreadyExists();

        IVerityMarketFactory factoryContract = IVerityMarketFactory(factory);
        uint256 totalUsdc = factoryContract.escrowBalances(marketId);

        if (totalUsdc < minPoolBalance) revert InsufficientDeposit();

        // Transfer total USDC from factory to this contract
        USDC.safeTransferFrom(factory, address(this), totalUsdc);

        // Approve vault to pull USDC for minting
        USDC.approve(address(VAULT), totalUsdc);

        if (outcomeCount == 0) {
            // Retrieve outcomeCount from vault
            (, , , outcomeCount) = VAULT.markets(marketId);
            if (outcomeCount == 0) {
                outcomeCount = 2;
            }
        }

        // Mint outcome tokens via vault
        VAULT.mintOutcomeTokens(
            marketId,
            address(this),
            totalUsdc,
            outcomeCount
        );

        (address creator, , , , , , ) = factoryContract.marketRegistry(
            marketId
        );

        // Initialize pool
        Pool storage pool = pools[marketId];
        pool.totalLpShares = totalUsdc; // 1:1 initial share ratio
        pool.creator = creator;
        pool.totalDeposited = totalUsdc;
        pool.active = true;

        for (uint256 i = 0; i < outcomeCount; i++) {
            pool.outcomeBalances.push(totalUsdc);
        }

        if (outcomeCount == 2) {
            pool.yesBalance = totalUsdc;
            pool.noBalance = totalUsdc;
        }

        emit PoolActivated(marketId, totalUsdc);
        emit PoolCreated(marketId, creator, totalUsdc);
    }

    /// @notice Claim LP shares for pre-market deposits after pool activation
    function claimPreMarketLpShares(bytes32 marketId) external {
        Pool storage pool = pools[marketId];
        if (!pool.active) revert PoolNotActive();

        IVerityMarketFactory factoryContract = IVerityMarketFactory(factory);
        uint256 amount = factoryContract.claimPreMarketDeposit(
            marketId,
            msg.sender
        );
        if (amount == 0) revert ZeroAmount();

        if (msg.sender == pool.creator) {
            uint256 currentlyLocked = pool.creatorShares;
            if (currentlyLocked < creatorMinLock) {
                uint256 remainingToLock = creatorMinLock - currentlyLocked;
                uint256 toLock = amount > remainingToLock
                    ? remainingToLock
                    : amount;
                pool.creatorShares += toLock;
                lpShares[marketId][msg.sender] += (amount - toLock);
            } else {
                lpShares[marketId][msg.sender] += amount;
            }
        } else {
            lpShares[marketId][msg.sender] += amount;
        }

        lpDepositTime[marketId][msg.sender] = block.timestamp;

        emit PreMarketLPSharesClaimed(marketId, msg.sender, amount);
    }

    // ─── Liquidity Management ────────────────────────────────────────────

    /// @notice Public LP adds liquidity to a pool.
    /// @param marketId Market identifier
    /// @param usdcAmount Amount of USDC to deposit
    function addLiquidity(bytes32 marketId, uint256 usdcAmount) external {
        if (usdcAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];
        if (pool.creator == address(0)) revert InvalidPool();
        if (pool.resolved) revert PoolNotActive();

        // Transfer USDC from LP to this contract
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Approve vault to pull USDC
        USDC.approve(address(VAULT), usdcAmount);

        // Retrieve outcomeCount from vault
        (, , , uint256 outcomeCount) = VAULT.markets(marketId);
        if (outcomeCount == 0) {
            outcomeCount = 2;
        }

        // Mint outcome tokens
        VAULT.mintOutcomeTokens(
            marketId,
            address(this),
            usdcAmount,
            outcomeCount
        );

        // Calculate LP shares to mint
        uint256 newShares;
        if (pool.totalLpShares == 0) {
            newShares = usdcAmount;
        } else {
            uint256 oldProduct = 1;
            uint256 newProduct = 1;
            for (uint256 i = 0; i < outcomeCount; i++) {
                uint256 bal = pool.outcomeBalances[i] / 1000;
                oldProduct = oldProduct * bal;
                newProduct =
                    newProduct *
                    ((pool.outcomeBalances[i] + usdcAmount) / 1000);
            }
            uint256 rootOld = nthRoot(oldProduct, outcomeCount);
            uint256 rootNew = nthRoot(newProduct, outcomeCount);
            newShares =
                (pool.totalLpShares * rootNew) /
                rootOld -
                pool.totalLpShares;
        }

        // Update pool state
        for (uint256 i = 0; i < outcomeCount; i++) {
            pool.outcomeBalances[i] += usdcAmount;
        }
        if (outcomeCount == 2) {
            pool.yesBalance = pool.outcomeBalances[0];
            pool.noBalance = pool.outcomeBalances[1];
        }
        pool.totalLpShares += newShares;
        pool.totalDeposited += usdcAmount;

        // Track LP position
        lpShares[marketId][msg.sender] += newShares;
        lpDepositTime[marketId][msg.sender] = block.timestamp;

        // Check activation threshold
        if (!pool.active && pool.totalDeposited >= minPoolBalance) {
            pool.active = true;
            emit PoolActivated(marketId, pool.totalDeposited);
        }

        emit LiquidityAdded(marketId, msg.sender, usdcAmount, newShares);
    }

    /// @notice Public LP adds liquidity to a pool on behalf of a beneficiary.
    /// @param marketId Market identifier
    /// @param beneficiary The address that will own the LP shares
    /// @param usdcAmount Amount of USDC to deposit
    function addLiquidityFor(
        bytes32 marketId,
        address beneficiary,
        uint256 usdcAmount
    ) external {
        if (usdcAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];
        if (pool.creator == address(0)) revert InvalidPool();
        if (pool.resolved) revert PoolNotActive();

        // Transfer USDC from caller to this contract
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Approve vault to pull USDC
        USDC.approve(address(VAULT), usdcAmount);

        // Retrieve outcomeCount from vault
        (, , , uint256 outcomeCount) = VAULT.markets(marketId);
        if (outcomeCount == 0) {
            outcomeCount = 2;
        }

        // Mint outcome tokens
        VAULT.mintOutcomeTokens(
            marketId,
            address(this),
            usdcAmount,
            outcomeCount
        );

        // Calculate LP shares to mint
        uint256 newShares;
        if (pool.totalLpShares == 0) {
            newShares = usdcAmount;
        } else {
            uint256 oldProduct = 1;
            uint256 newProduct = 1;
            for (uint256 i = 0; i < outcomeCount; i++) {
                uint256 bal = pool.outcomeBalances[i] / 1000;
                oldProduct = oldProduct * bal;
                newProduct =
                    newProduct *
                    ((pool.outcomeBalances[i] + usdcAmount) / 1000);
            }
            uint256 rootOld = nthRoot(oldProduct, outcomeCount);
            uint256 rootNew = nthRoot(newProduct, outcomeCount);
            newShares =
                (pool.totalLpShares * rootNew) /
                rootOld -
                pool.totalLpShares;
        }

        // Update pool state
        for (uint256 i = 0; i < outcomeCount; i++) {
            pool.outcomeBalances[i] += usdcAmount;
        }
        if (outcomeCount == 2) {
            pool.yesBalance = pool.outcomeBalances[0];
            pool.noBalance = pool.outcomeBalances[1];
        }
        pool.totalLpShares += newShares;
        pool.totalDeposited += usdcAmount;

        // Track LP position for beneficiary
        lpShares[marketId][beneficiary] += newShares;
        lpDepositTime[marketId][beneficiary] = block.timestamp;

        // Check activation threshold
        if (!pool.active && pool.totalDeposited >= minPoolBalance) {
            pool.active = true;
            emit PoolActivated(marketId, pool.totalDeposited);
        }

        emit LiquidityAdded(marketId, beneficiary, usdcAmount, newShares);
    }

    /// @notice Public LP removes liquidity from a pool.
    /// @param marketId Market identifier
    /// @param shareAmount Number of LP shares to burn
    function removeLiquidity(bytes32 marketId, uint256 shareAmount) external {
        if (shareAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];
        if (pool.creator == address(0)) revert InvalidPool();

        uint256 userShares = lpShares[marketId][msg.sender];
        if (userShares < shareAmount) revert InsufficientShares();

        // 24h lock check for LPs (skip if pool is resolved)
        if (!pool.resolved) {
            if (
                block.timestamp <
                lpDepositTime[marketId][msg.sender] + lpLockDuration
            ) {
                revert LPLockActive();
            }
        }

        uint256 outcomeCount = pool.outcomeBalances.length;
        if (outcomeCount == 0) {
            outcomeCount = 2;
        }

        uint256[] memory outs = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; i++) {
            uint256 bal = pool.outcomeBalances.length > 0
                ? pool.outcomeBalances[i]
                : (i == 0 ? pool.yesBalance : pool.noBalance);
            outs[i] = (bal * shareAmount) / pool.totalLpShares;
        }

        // Update pool state
        for (uint256 i = 0; i < pool.outcomeBalances.length; i++) {
            pool.outcomeBalances[i] -= outs[i];
        }
        if (pool.outcomeBalances.length >= 2) {
            pool.yesBalance = pool.outcomeBalances[0];
            pool.noBalance = pool.outcomeBalances[1];
        } else {
            pool.yesBalance -= outs[0];
            pool.noBalance -= outs[1];
        }
        pool.totalLpShares -= shareAmount;
        lpShares[marketId][msg.sender] -= shareAmount;

        if (pool.resolved) {
            // Determine if vault is resolved
            (bool resolved, uint256 winningOutcomeIndex, , ) = VAULT.markets(
                marketId
            );
            if (resolved) {
                // Resolved market: pay out the winning portion in USDC
                uint256 usdcOut = outs[winningOutcomeIndex];
                if (usdcOut > 0) {
                    USDC.safeTransfer(msg.sender, usdcOut);
                }
            } else {
                // Voided market: burn equal pairs of outcomes to get USDC
                uint256 burnAmount = outs[0];
                for (uint256 i = 1; i < outcomeCount; i++) {
                    if (outs[i] < burnAmount) {
                        burnAmount = outs[i];
                    }
                }
                if (burnAmount > 0) {
                    VAULT.burnOutcomeTokens(
                        marketId,
                        address(this),
                        burnAmount,
                        outcomeCount
                    );
                    USDC.safeTransfer(msg.sender, burnAmount);
                }
                // Transfer dust
                for (uint256 i = 0; i < outcomeCount; i++) {
                    if (outs[i] > burnAmount) {
                        uint256 tokenId = VAULT.outcomeTokenId(marketId, i);
                        VAULT.safeTransferFrom(
                            address(this),
                            msg.sender,
                            tokenId,
                            outs[i] - burnAmount,
                            ""
                        );
                    }
                }
            }
        } else {
            // Unresolved market (normal LP removal): Transfer outcome tokens to LP
            for (uint256 i = 0; i < outcomeCount; i++) {
                uint256 tokenId = VAULT.outcomeTokenId(marketId, i);
                VAULT.safeTransferFrom(
                    address(this),
                    msg.sender,
                    tokenId,
                    outs[i],
                    ""
                );
            }
        }

        emit LiquidityRemoved(
            marketId,
            msg.sender,
            shareAmount,
            outs[0],
            outcomeCount > 1 ? outs[1] : 0
        );
    }

    /// @notice Creator claims their locked liquidity after market resolution.
    /// @param marketId Market identifier
    function claimCreatorLiquidity(bytes32 marketId) external {
        Pool storage pool = pools[marketId];
        if (msg.sender != pool.creator) revert NotCreator();
        if (!pool.resolved) revert PoolNotResolved();

        uint256 creatorShareAmount = lpShares[marketId][msg.sender] +
            pool.creatorShares;
        if (creatorShareAmount == 0) revert InsufficientShares();

        uint256 outcomeCount = pool.outcomeBalances.length;
        if (outcomeCount == 0) {
            outcomeCount = 2;
        }

        uint256[] memory outs = new uint256[](outcomeCount);
        for (uint256 i = 0; i < outcomeCount; i++) {
            uint256 bal = pool.outcomeBalances.length > 0
                ? pool.outcomeBalances[i]
                : (i == 0 ? pool.yesBalance : pool.noBalance);
            outs[i] = (bal * creatorShareAmount) / pool.totalLpShares;
        }

        // Update pool state
        for (uint256 i = 0; i < pool.outcomeBalances.length; i++) {
            pool.outcomeBalances[i] -= outs[i];
        }
        if (pool.outcomeBalances.length >= 2) {
            pool.yesBalance = pool.outcomeBalances[0];
            pool.noBalance = pool.outcomeBalances[1];
        } else {
            pool.yesBalance -= outs[0];
            pool.noBalance -= outs[1];
        }
        pool.totalLpShares -= creatorShareAmount;
        lpShares[marketId][msg.sender] = 0;
        pool.creatorShares = 0;

        // Determine if vault is resolved
        (bool resolved, uint256 winningOutcomeIndex, , ) = VAULT.markets(
            marketId
        );
        if (resolved) {
            uint256 usdcOut = outs[winningOutcomeIndex];
            if (usdcOut > 0) {
                USDC.safeTransfer(msg.sender, usdcOut);
            }
        } else {
            // Voided: burn pairs and return USDC
            uint256 burnAmount = outs[0];
            for (uint256 i = 1; i < outcomeCount; i++) {
                if (outs[i] < burnAmount) {
                    burnAmount = outs[i];
                }
            }
            if (burnAmount > 0) {
                VAULT.burnOutcomeTokens(
                    marketId,
                    address(this),
                    burnAmount,
                    outcomeCount
                );
                USDC.safeTransfer(msg.sender, burnAmount);
            }
            // Transfer dust if any
            for (uint256 i = 0; i < outcomeCount; i++) {
                if (outs[i] > burnAmount) {
                    uint256 tokenId = VAULT.outcomeTokenId(marketId, i);
                    VAULT.safeTransferFrom(
                        address(this),
                        msg.sender,
                        tokenId,
                        outs[i] - burnAmount,
                        ""
                    );
                }
            }
        }

        emit CreatorLiquidityClaimed(
            marketId,
            msg.sender,
            outs[0],
            outcomeCount > 1 ? outs[1] : 0
        );
    }

    // ─── Trading ─────────────────────────────────────────────────────────

    /// @notice Buy outcome tokens using USDC via the FPMM formula.
    /// @param marketId Market identifier
    /// @param isYes true to buy YES tokens, false to buy NO tokens
    /// @param usdcAmount Total USDC to spend (fee is deducted from this)
    /// @return tokensOut Number of outcome tokens received
    function buy(
        bytes32 marketId,
        bool isYes,
        uint256 usdcAmount
    ) external poolMustBeActive(marketId) returns (uint256 tokensOut) {
        if (usdcAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];

        // 1. Calculate and split fee
        uint256 fee = (usdcAmount * feeBps) / BPS_DENOMINATOR;
        uint256 feeLp = (fee * lpFeeShare) / 100;
        uint256 feeTreasury = fee - feeLp;
        uint256 actualAmount = usdcAmount - fee;

        // 2. Transfer USDC from buyer
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // 3. Send treasury fee
        if (feeTreasury > 0) {
            USDC.safeTransfer(treasury, feeTreasury);
        }

        // 4. Track LP fees (stays in contract as extra value for LPs)
        pool.collectedFeesLp += feeLp;
        pool.collectedFeesTreasury += feeTreasury;

        // 5. Mint YES + NO tokens via vault
        USDC.approve(address(VAULT), actualAmount);
        VAULT.mintPair(marketId, address(this), actualAmount);

        // 6. Apply FPMM formula
        uint256 y = pool.yesBalance;
        uint256 n = pool.noBalance;

        if (isYes) {
            // Buying YES: add NO to pool, release YES
            pool.noBalance = n + actualAmount;
            // Maintain invariant: y' = (y * n) / (n + actualAmount)
            uint256 yNew = (y * n) / (n + actualAmount);
            uint256 tokensFromPool = y - yNew;
            pool.yesBalance = yNew;
            tokensOut = actualAmount + tokensFromPool;

            // Transfer YES tokens to buyer
            uint256 yesId = VAULT.yesTokenId(marketId);
            VAULT.safeTransferFrom(
                address(this),
                msg.sender,
                yesId,
                tokensOut,
                ""
            );
        } else {
            // Buying NO: add YES to pool, release NO
            pool.yesBalance = y + actualAmount;
            uint256 nNew = (y * n) / (y + actualAmount);
            uint256 tokensFromPool = n - nNew;
            pool.noBalance = nNew;
            tokensOut = actualAmount + tokensFromPool;

            // Transfer NO tokens to buyer
            uint256 noId = VAULT.noTokenId(marketId);
            VAULT.safeTransferFrom(
                address(this),
                msg.sender,
                noId,
                tokensOut,
                ""
            );
        }

        if (pool.outcomeBalances.length >= 2) {
            pool.outcomeBalances[0] = pool.yesBalance;
            pool.outcomeBalances[1] = pool.noBalance;
        }

        emit TokensBought(
            marketId,
            msg.sender,
            isYes,
            usdcAmount,
            tokensOut,
            fee
        );
    }

    /// @notice Sell outcome tokens back to the pool for USDC.
    /// @param marketId Market identifier
    /// @param isYes true to sell YES tokens, false to sell NO tokens
    /// @param tokenAmount Number of outcome tokens to sell
    /// @return usdcOut Net USDC received after fees
    function sell(
        bytes32 marketId,
        bool isYes,
        uint256 tokenAmount
    ) external poolMustBeActive(marketId) returns (uint256 usdcOut) {
        if (tokenAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];

        uint256 y = pool.yesBalance;
        uint256 n = pool.noBalance;

        // 1. Transfer tokens from seller to this contract
        uint256 tokenId = isYes
            ? VAULT.yesTokenId(marketId)
            : VAULT.noTokenId(marketId);
        VAULT.safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            tokenAmount,
            ""
        );

        // 2. Solve the quadratic equation to find grossUsdc returned
        //    (y' * n' = y * n) where:
        //    If isYes:
        //      y' = y + tokenAmount - grossUsdc
        //      n' = n - grossUsdc
        //    Solving for grossUsdc gives the smaller root of:
        //      grossUsdc^2 - (y + tokenAmount + n) * grossUsdc + tokenAmount * n = 0
        uint256 grossUsdc;
        if (isYes) {
            uint256 b = y + tokenAmount + n;
            uint256 c = tokenAmount * n;
            uint256 discriminant = b * b - 4 * c;
            uint256 sqrtD = Math.sqrt(discriminant);
            grossUsdc = (b - sqrtD) / 2;

            pool.yesBalance = y + tokenAmount - grossUsdc;
            pool.noBalance = n - grossUsdc;
        } else {
            uint256 b = n + tokenAmount + y;
            uint256 c = tokenAmount * y;
            uint256 discriminant = b * b - 4 * c;
            uint256 sqrtD = Math.sqrt(discriminant);
            grossUsdc = (b - sqrtD) / 2;

            pool.noBalance = n + tokenAmount - grossUsdc;
            pool.yesBalance = y - grossUsdc;
        }

        // 3. Burn the pairs to retrieve USDC
        VAULT.burnPair(marketId, address(this), grossUsdc);

        // 4. Deduct fee
        uint256 fee = (grossUsdc * feeBps) / BPS_DENOMINATOR;
        uint256 feeLp = (fee * lpFeeShare) / 100;
        uint256 feeTreasury = fee - feeLp;
        usdcOut = grossUsdc - fee;

        pool.collectedFeesLp += feeLp;
        pool.collectedFeesTreasury += feeTreasury;

        // 5. Send treasury fee and net USDC to seller
        if (feeTreasury > 0) {
            USDC.safeTransfer(treasury, feeTreasury);
        }
        USDC.safeTransfer(msg.sender, usdcOut);

        if (pool.outcomeBalances.length >= 2) {
            pool.outcomeBalances[0] = pool.yesBalance;
            pool.outcomeBalances[1] = pool.noBalance;
        }

        emit TokensSold(marketId, msg.sender, isYes, tokenAmount, usdcOut, fee);
    }

    // ─── Resolution (called by Factory) ──────────────────────────────────

    function markResolved(bytes32 marketId) external onlyFactory {
        pools[marketId].resolved = true;

        // Query winning outcome from vault
        (bool resolved, uint256 winningOutcomeIndex, , ) = VAULT.markets(
            marketId
        );
        if (resolved) {
            uint256 winningId = VAULT.outcomeTokenId(
                marketId,
                winningOutcomeIndex
            );
            uint256 winningBalance = VAULT.balanceOf(address(this), winningId);
            if (winningBalance > 0) {
                // Redeem all winning tokens held by the pool for USDC
                VAULT.redeem(marketId);
            }
        }
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get YES implied probability (scaled by 1e18)
    function getYesPrice(bytes32 marketId) external view returns (uint256) {
        Pool storage pool = pools[marketId];
        uint256 total = pool.yesBalance + pool.noBalance;
        if (total == 0) return PRECISION / 2; // 50%
        return (pool.noBalance * PRECISION) / total;
    }

    /// @notice Get NO implied probability (scaled by 1e18)
    function getNoPrice(bytes32 marketId) public view returns (uint256) {
        Pool storage pool = pools[marketId];
        uint256 total = pool.yesBalance + pool.noBalance;
        if (total == 0) return PRECISION / 2; // 50%
        uint256 yesPrice = (pool.noBalance * PRECISION) / total;
        return PRECISION - yesPrice;
    }

    /// @notice Check if a user can remove liquidity (24h lock check)
    function canRemoveLiquidity(
        bytes32 marketId,
        address user
    ) external view returns (bool) {
        Pool storage pool = pools[marketId];
        if (user == pool.creator && !pool.resolved) return false;
        if (pool.resolved) return true;
        return
            block.timestamp >= lpDepositTime[marketId][user] + lpLockDuration;
    }

    /// @notice Get pool balances
    function getPoolBalances(
        bytes32 marketId
    )
        external
        view
        returns (
            uint256 yesBalance,
            uint256 noBalance,
            uint256 totalLpShares,
            uint256 totalDeposited,
            bool active,
            bool resolved
        )
    {
        Pool storage pool = pools[marketId];
        return (
            pool.yesBalance,
            pool.noBalance,
            pool.totalLpShares,
            pool.totalDeposited,
            pool.active,
            pool.resolved
        );
    }

    /// @notice Get all outcome balances for a pool
    function getOutcomeBalances(
        bytes32 marketId
    ) external view returns (uint256[] memory) {
        return pools[marketId].outcomeBalances;
    }

    /// @notice Buy a specific outcome token using USDC via the generalized constant product formula.
    /// @param marketId Market identifier
    /// @param outcomeIndex Index of the outcome to buy
    /// @param usdcAmount Total USDC to spend (fee is deducted from this)
    /// @return tokensOut Number of outcome tokens received
    function buyOutcome(
        bytes32 marketId,
        uint256 outcomeIndex,
        uint256 usdcAmount
    ) external poolMustBeActive(marketId) returns (uint256 tokensOut) {
        if (usdcAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];
        uint256 outcomeCount = pool.outcomeBalances.length;
        require(outcomeIndex < outcomeCount, "Invalid outcome index");

        // 1. Calculate and split fee
        uint256 fee = (usdcAmount * feeBps) / BPS_DENOMINATOR;
        uint256 feeLp = (fee * lpFeeShare) / 100;
        uint256 feeTreasury = fee - feeLp;
        uint256 actualAmount = usdcAmount - fee;

        // 2. Transfer USDC from buyer
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // 3. Send treasury fee
        if (feeTreasury > 0) {
            USDC.safeTransfer(treasury, feeTreasury);
        }

        // 4. Track LP fees
        pool.collectedFeesLp += feeLp;
        pool.collectedFeesTreasury += feeTreasury;

        // 5. Mint outcome tokens via vault
        USDC.approve(address(VAULT), actualAmount);
        VAULT.mintOutcomeTokens(
            marketId,
            address(this),
            actualAmount,
            outcomeCount
        );

        // 6. Apply multi-outcome constant product formula iteratively to prevent overflow
        uint256 outcomeBalanceNew = pool.outcomeBalances[outcomeIndex];
        for (uint256 i = 0; i < outcomeCount; i++) {
            if (i != outcomeIndex) {
                outcomeBalanceNew = Math.mulDiv(
                    outcomeBalanceNew,
                    pool.outcomeBalances[i],
                    pool.outcomeBalances[i] + actualAmount
                );
            }
        }
        uint256 xJ = pool.outcomeBalances[outcomeIndex];
        tokensOut = (xJ + actualAmount) - outcomeBalanceNew;

        // 7. Update pool balances in storage
        for (uint256 i = 0; i < outcomeCount; i++) {
            if (i == outcomeIndex) {
                pool.outcomeBalances[i] = outcomeBalanceNew;
            } else {
                pool.outcomeBalances[i] += actualAmount;
            }
        }

        // 8. Sync yesBalance/noBalance for legacy compatibility
        if (outcomeCount == 2) {
            pool.yesBalance = pool.outcomeBalances[0];
            pool.noBalance = pool.outcomeBalances[1];
        }

        // 9. Transfer purchased outcome tokens to buyer
        uint256 tokenId = VAULT.outcomeTokenId(marketId, outcomeIndex);
        VAULT.safeTransferFrom(
            address(this),
            msg.sender,
            tokenId,
            tokensOut,
            ""
        );

        emit TokensBought(
            marketId,
            msg.sender,
            outcomeIndex == 0,
            usdcAmount,
            tokensOut,
            fee
        );
    }

    /// @notice Sell outcome tokens back to the pool for USDC via the generalized constant product formula.
    /// @param marketId Market identifier
    /// @param outcomeIndex Index of the outcome to sell
    /// @param tokenAmount Number of outcome tokens to sell
    /// @return usdcOut Net USDC received after fees
    function sellOutcome(
        bytes32 marketId,
        uint256 outcomeIndex,
        uint256 tokenAmount
    ) external poolMustBeActive(marketId) returns (uint256 usdcOut) {
        if (tokenAmount == 0) revert ZeroAmount();
        Pool storage pool = pools[marketId];
        uint256 outcomeCount = pool.outcomeBalances.length;
        require(outcomeIndex < outcomeCount, "Invalid outcome index");

        // 1. Transfer tokens from seller to this contract
        uint256 tokenId = VAULT.outcomeTokenId(marketId, outcomeIndex);
        VAULT.safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            tokenAmount,
            ""
        );

        // 2. Solve for grossUsdc using binary search
        uint256 grossUsdc = solveSellGrossUsdc(
            pool.outcomeBalances,
            outcomeIndex,
            tokenAmount
        );

        // 3. Update pool balances in storage
        for (uint256 i = 0; i < outcomeCount; i++) {
            if (i == outcomeIndex) {
                pool.outcomeBalances[i] =
                    pool.outcomeBalances[i] +
                    tokenAmount -
                    grossUsdc;
            } else {
                pool.outcomeBalances[i] = pool.outcomeBalances[i] - grossUsdc;
            }
        }

        // 4. Sync yesBalance/noBalance for legacy compatibility
        if (outcomeCount == 2) {
            pool.yesBalance = pool.outcomeBalances[0];
            pool.noBalance = pool.outcomeBalances[1];
        }

        // 5. Burn the pairs via vault
        VAULT.burnOutcomeTokens(
            marketId,
            address(this),
            grossUsdc,
            outcomeCount
        );

        // 6. Deduct fee
        uint256 fee = (grossUsdc * feeBps) / BPS_DENOMINATOR;
        uint256 feeLp = (fee * lpFeeShare) / 100;
        uint256 feeTreasury = fee - feeLp;
        usdcOut = grossUsdc - fee;

        pool.collectedFeesLp += feeLp;
        pool.collectedFeesTreasury += feeTreasury;

        // 7. Send treasury fee and net USDC to seller
        if (feeTreasury > 0) {
            USDC.safeTransfer(treasury, feeTreasury);
        }
        USDC.safeTransfer(msg.sender, usdcOut);

        emit TokensSold(
            marketId,
            msg.sender,
            outcomeIndex == 0,
            tokenAmount,
            usdcOut,
            fee
        );
    }

    function solveSellGrossUsdc(
        uint256[] memory balances,
        uint256 outcomeIndex,
        uint256 tokenAmount
    ) public pure returns (uint256) {
        uint256 outcomeCount = balances.length;
        uint256 k = 1;
        for (uint256 i = 0; i < outcomeCount; i++) {
            k = k * balances[i];
        }

        uint256 low = 0;
        uint256 high = balances[outcomeIndex] + tokenAmount;
        for (uint256 i = 0; i < outcomeCount; i++) {
            if (i != outcomeIndex && balances[i] < high) {
                high = balances[i];
            }
        }

        uint256 grossUsdc = 0;
        for (uint256 iter = 0; iter < 30; iter++) {
            uint256 mid = (low + high) / 2;
            uint256 product = balances[outcomeIndex] + tokenAmount - mid;
            for (uint256 i = 0; i < outcomeCount; i++) {
                if (i != outcomeIndex) {
                    product = product * (balances[i] - mid);
                }
            }

            if (product > k) {
                low = mid;
                grossUsdc = mid;
            } else {
                high = mid;
            }
        }
        return grossUsdc;
    }

    function nthRoot(uint256 x, uint256 n) public pure returns (uint256) {
        if (x == 0) return 0;
        if (n == 1) return x;
        if (n == 2) return Math.sqrt(x);

        uint256 y = 40_000;
        uint256 yPrev = 0;
        for (uint256 i = 0; i < 30; i++) {
            uint256 denom = 1;
            for (uint256 j = 0; j < n - 1; j++) {
                denom = denom * y;
            }
            uint256 yNext = ((n - 1) * y + x / denom) / n;
            if (yNext == y || yNext == yPrev) {
                y = yNext;
                break;
            }
            yPrev = y;
            y = yNext;
        }
        return y;
    }
}
