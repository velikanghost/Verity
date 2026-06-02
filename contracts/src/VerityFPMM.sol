// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./ConditionalTokenVault.sol";

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
    uint256 public constant FEE_BPS = 200; // 2% trading fee
    uint256 public constant LP_FEE_SHARE = 60; // 60% of fees → LPs
    uint256 public constant TREASURY_FEE_SHARE = 40; // 40% of fees → treasury
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MIN_POOL_BALANCE = 40e6; // 40 USDC (6 decimals)
    uint256 public constant CREATOR_MIN_LOCK = 10e6; // 10 USDC minimum locked by creator
    uint256 public constant LP_LOCK_DURATION = 24 hours;
    uint256 public constant PRECISION = 1e18; // For price calculations

    // ─── State ───────────────────────────────────────────────────────────
    ConditionalTokenVault public immutable vault;
    IERC20 public immutable usdc;
    address public admin;
    address public factory; // Authorized VerityMarketFactory
    address public treasury; // Verity protocol treasury for 40% fees

    struct Pool {
        uint256 yesBalance;
        uint256 noBalance;
        uint256 totalLPShares;
        uint256 creatorShares;
        address creator;
        uint256 collectedFeesLP;
        uint256 collectedFeesTreasury;
        uint256 totalDeposited;
        bool active; // true once totalDeposited >= MIN_POOL_BALANCE
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

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier poolMustBeActive(bytes32 marketId) {
        if (!pools[marketId].active) revert PoolNotActive();
        if (pools[marketId].resolved) revert PoolNotActive();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _vault, address _usdc, address _treasury) {
        vault = ConditionalTokenVault(_vault);
        usdc = IERC20(_usdc);
        treasury = _treasury;
        admin = msg.sender;
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

    // ─── Pool Creation (called by Factory) ───────────────────────────────

    /// @notice Creates the pool after the escrow threshold is reached.
    /// @param marketId Market identifier (bytes32)
    function createPool(bytes32 marketId) external onlyFactory {
        if (pools[marketId].creator != address(0)) revert PoolAlreadyExists();

        IVerityMarketFactory factoryContract = IVerityMarketFactory(factory);
        uint256 totalUsdc = factoryContract.escrowBalances(marketId);

        if (totalUsdc < MIN_POOL_BALANCE) revert InsufficientDeposit();

        // Transfer total USDC from factory to this contract
        usdc.safeTransferFrom(factory, address(this), totalUsdc);

        // Approve vault to pull USDC for minting
        usdc.approve(address(vault), totalUsdc);

        // Mint YES + NO tokens via vault
        vault.mintPair(marketId, address(this), totalUsdc);

        (address creator, , , , , , ) = factoryContract.marketRegistry(
            marketId
        );

        // Initialize pool
        Pool storage pool = pools[marketId];
        pool.yesBalance = totalUsdc;
        pool.noBalance = totalUsdc;
        pool.totalLPShares = totalUsdc; // 1:1 initial share ratio
        pool.creator = creator;
        pool.totalDeposited = totalUsdc;
        pool.active = true;

        emit PoolActivated(marketId, totalUsdc);
        emit PoolCreated(marketId, creator, totalUsdc);
    }

    /// @notice Claim LP shares for pre-market deposits after pool activation
    function claimPreMarketLPShares(bytes32 marketId) external {
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
            if (currentlyLocked < CREATOR_MIN_LOCK) {
                uint256 remainingToLock = CREATOR_MIN_LOCK - currentlyLocked;
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
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Approve vault to pull USDC
        usdc.approve(address(vault), usdcAmount);

        // Mint YES + NO tokens
        vault.mintPair(marketId, address(this), usdcAmount);

        // Calculate LP shares to mint
        uint256 newShares;
        if (pool.totalLPShares == 0) {
            newShares = usdcAmount;
        } else {
            uint256 newProduct = (pool.yesBalance + usdcAmount) *
                (pool.noBalance + usdcAmount);
            uint256 oldProduct = pool.yesBalance * pool.noBalance;
            uint256 sqrtNew = Math.sqrt(newProduct);
            uint256 sqrtOld = Math.sqrt(oldProduct);
            newShares =
                (pool.totalLPShares * sqrtNew) /
                sqrtOld -
                pool.totalLPShares;
        }

        // Update pool state
        pool.yesBalance += usdcAmount;
        pool.noBalance += usdcAmount;
        pool.totalLPShares += newShares;
        pool.totalDeposited += usdcAmount;

        // Track LP position
        lpShares[marketId][msg.sender] += newShares;
        lpDepositTime[marketId][msg.sender] = block.timestamp;

        // Check activation threshold
        if (!pool.active && pool.totalDeposited >= MIN_POOL_BALANCE) {
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
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // Approve vault to pull USDC
        usdc.approve(address(vault), usdcAmount);

        // Mint YES + NO tokens
        vault.mintPair(marketId, address(this), usdcAmount);

        // Calculate LP shares to mint
        uint256 newShares;
        if (pool.totalLPShares == 0) {
            newShares = usdcAmount;
        } else {
            uint256 newProduct = (pool.yesBalance + usdcAmount) *
                (pool.noBalance + usdcAmount);
            uint256 oldProduct = pool.yesBalance * pool.noBalance;
            uint256 sqrtNew = Math.sqrt(newProduct);
            uint256 sqrtOld = Math.sqrt(oldProduct);
            newShares =
                (pool.totalLPShares * sqrtNew) /
                sqrtOld -
                pool.totalLPShares;
        }

        // Update pool state
        pool.yesBalance += usdcAmount;
        pool.noBalance += usdcAmount;
        pool.totalLPShares += newShares;
        pool.totalDeposited += usdcAmount;

        // Track LP position for beneficiary
        lpShares[marketId][beneficiary] += newShares;
        lpDepositTime[marketId][beneficiary] = block.timestamp;

        // Check activation threshold
        if (!pool.active && pool.totalDeposited >= MIN_POOL_BALANCE) {
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
                lpDepositTime[marketId][msg.sender] + LP_LOCK_DURATION
            ) {
                revert LPLockActive();
            }
        }

        // Calculate proportional token amounts
        uint256 yesOut = (pool.yesBalance * shareAmount) / pool.totalLPShares;
        uint256 noOut = (pool.noBalance * shareAmount) / pool.totalLPShares;

        // Update pool state
        pool.yesBalance -= yesOut;
        pool.noBalance -= noOut;
        pool.totalLPShares -= shareAmount;
        lpShares[marketId][msg.sender] -= shareAmount;

        if (pool.resolved) {
            // Determine if vault is resolved
            (bool resolved, bool winningIsYes, ) = vault.markets(marketId);
            if (resolved) {
                // Resolved market: pay out the winning portion in USDC
                uint256 usdcOut = winningIsYes ? yesOut : noOut;
                if (usdcOut > 0) {
                    usdc.safeTransfer(msg.sender, usdcOut);
                }
            } else {
                // Voided market: burn equal pairs of YES and NO to get USDC, and send to LP
                uint256 burnAmount = yesOut < noOut ? yesOut : noOut;
                if (burnAmount > 0) {
                    vault.burnPair(marketId, address(this), burnAmount);
                    usdc.safeTransfer(msg.sender, burnAmount);
                }
                // Transfer any remaining dust tokens (should be 0 or tiny)
                uint256 yesId = vault.yesTokenId(marketId);
                uint256 noId = vault.noTokenId(marketId);
                if (yesOut > burnAmount) {
                    vault.safeTransferFrom(
                        address(this),
                        msg.sender,
                        yesId,
                        yesOut - burnAmount,
                        ""
                    );
                }
                if (noOut > burnAmount) {
                    vault.safeTransferFrom(
                        address(this),
                        msg.sender,
                        noId,
                        noOut - burnAmount,
                        ""
                    );
                }
            }
        } else {
            // Unresolved market (normal LP removal): Transfer YES + NO tokens to the LP
            uint256 yesId = vault.yesTokenId(marketId);
            uint256 noId = vault.noTokenId(marketId);
            vault.safeTransferFrom(
                address(this),
                msg.sender,
                yesId,
                yesOut,
                ""
            );
            vault.safeTransferFrom(address(this), msg.sender, noId, noOut, "");
        }

        emit LiquidityRemoved(marketId, msg.sender, shareAmount, yesOut, noOut);
    }

    /// @notice Creator claims their locked liquidity after market resolution.
    /// @param marketId Market identifier
    function claimCreatorLiquidity(bytes32 marketId) external {
        Pool storage pool = pools[marketId];
        if (msg.sender != pool.creator) revert NotCreator();
        if (!pool.resolved) revert PoolNotResolved();

        uint256 creatorShareAmount = lpShares[marketId][msg.sender];
        if (creatorShareAmount == 0) revert InsufficientShares();

        // Calculate proportional token amounts
        uint256 yesOut = (pool.yesBalance * creatorShareAmount) /
            pool.totalLPShares;
        uint256 noOut = (pool.noBalance * creatorShareAmount) /
            pool.totalLPShares;

        // Update pool state
        pool.yesBalance -= yesOut;
        pool.noBalance -= noOut;
        pool.totalLPShares -= creatorShareAmount;
        lpShares[marketId][msg.sender] = 0;

        // Determine if vault is resolved
        (bool resolved, bool winningIsYes, ) = vault.markets(marketId);
        if (resolved) {
            uint256 usdcOut = winningIsYes ? yesOut : noOut;
            if (usdcOut > 0) {
                usdc.safeTransfer(msg.sender, usdcOut);
            }
        } else {
            // Voided: burn pairs and return USDC
            uint256 burnAmount = yesOut < noOut ? yesOut : noOut;
            if (burnAmount > 0) {
                vault.burnPair(marketId, address(this), burnAmount);
                usdc.safeTransfer(msg.sender, burnAmount);
            }
            // Transfer dust if any
            uint256 yesId = vault.yesTokenId(marketId);
            uint256 noId = vault.noTokenId(marketId);
            if (yesOut > burnAmount) {
                vault.safeTransferFrom(
                    address(this),
                    msg.sender,
                    yesId,
                    yesOut - burnAmount,
                    ""
                );
            }
            if (noOut > burnAmount) {
                vault.safeTransferFrom(
                    address(this),
                    msg.sender,
                    noId,
                    noOut - burnAmount,
                    ""
                );
            }
        }

        emit CreatorLiquidityClaimed(marketId, msg.sender, yesOut, noOut);
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
        uint256 fee = (usdcAmount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 feeLP = (fee * LP_FEE_SHARE) / 100;
        uint256 feeTreasury = fee - feeLP;
        uint256 actualAmount = usdcAmount - fee;

        // 2. Transfer USDC from buyer
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        // 3. Send treasury fee
        if (feeTreasury > 0) {
            usdc.safeTransfer(treasury, feeTreasury);
        }

        // 4. Track LP fees (stays in contract as extra value for LPs)
        pool.collectedFeesLP += feeLP;
        pool.collectedFeesTreasury += feeTreasury;

        // 5. Mint YES + NO tokens via vault
        usdc.approve(address(vault), actualAmount);
        vault.mintPair(marketId, address(this), actualAmount);

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
            uint256 yesId = vault.yesTokenId(marketId);
            vault.safeTransferFrom(
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
            uint256 noId = vault.noTokenId(marketId);
            vault.safeTransferFrom(
                address(this),
                msg.sender,
                noId,
                tokensOut,
                ""
            );
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
            ? vault.yesTokenId(marketId)
            : vault.noTokenId(marketId);
        vault.safeTransferFrom(
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
        vault.burnPair(marketId, address(this), grossUsdc);

        // 4. Deduct fee
        uint256 fee = (grossUsdc * FEE_BPS) / BPS_DENOMINATOR;
        uint256 feeLP = (fee * LP_FEE_SHARE) / 100;
        uint256 feeTreasury = fee - feeLP;
        usdcOut = grossUsdc - fee;

        pool.collectedFeesLP += feeLP;
        pool.collectedFeesTreasury += feeTreasury;

        // 5. Send treasury fee and net USDC to seller
        if (feeTreasury > 0) {
            usdc.safeTransfer(treasury, feeTreasury);
        }
        usdc.safeTransfer(msg.sender, usdcOut);

        emit TokensSold(marketId, msg.sender, isYes, tokenAmount, usdcOut, fee);
    }

    // ─── Resolution (called by Factory) ──────────────────────────────────

    /// @notice Mark pool as resolved. Called by factory after vault resolution.
    function markResolved(bytes32 marketId) external onlyFactory {
        pools[marketId].resolved = true;

        // Query winning outcome from vault
        (bool resolved, bool winningIsYes, ) = vault.markets(marketId);
        if (resolved) {
            uint256 winningId = winningIsYes
                ? vault.yesTokenId(marketId)
                : vault.noTokenId(marketId);
            uint256 winningBalance = vault.balanceOf(address(this), winningId);
            if (winningBalance > 0) {
                // Redeem all winning tokens held by the pool for USDC
                vault.redeem(marketId);
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
            block.timestamp >= lpDepositTime[marketId][user] + LP_LOCK_DURATION;
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
            uint256 totalLPShares,
            uint256 totalDeposited,
            bool active,
            bool resolved
        )
    {
        Pool storage pool = pools[marketId];
        return (
            pool.yesBalance,
            pool.noBalance,
            pool.totalLPShares,
            pool.totalDeposited,
            pool.active,
            pool.resolved
        );
    }
}
