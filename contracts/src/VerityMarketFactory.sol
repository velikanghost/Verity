// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./ConditionalTokenVault.sol";
import "./VerityFPMM.sol";

/// @title VerityMarketFactory
/// @notice Lightweight registry and admin interface for Verity prediction markets.
///         Manages market registration, creator funding, admin resolution, and auto-void.
contract VerityMarketFactory {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────
    VerityFPMM public immutable fpmm;
    ConditionalTokenVault public immutable vault;
    IERC20 public immutable usdc;
    IPyth public immutable pyth;
    address public admin;
    address public optimisticResolver;

    struct PreMarketDeposit {
        address lp;
        uint256 amount;
    }

    struct MarketInfo {
        address creator;
        uint256 deadline;         // Market trading deadline
        uint256 fundingDeadline;  // Deadline to reach MIN_POOL_BALANCE, else auto-void
        bool registered;
        bool funded;              // Creator has deposited initial USDC
        bool resolved;
        bool voided;
    }

    struct PythMarketParams {
        bytes32 priceFeedId;
        int64 targetPrice;
        bool resolveAbove;
        bool isPythMarket;
    }

    mapping(bytes32 => MarketInfo) public marketRegistry;
    mapping(bytes32 => PythMarketParams) public pythMarkets;
    mapping(bytes32 => mapping(address => uint256)) public preMarketDeposits;
    mapping(bytes32 => uint256) public escrowBalances;
    bytes32[] public allMarketIds;

    // ─── Events ──────────────────────────────────────────────────────────
    event MarketRegistered(bytes32 indexed marketId, address indexed creator, uint256 deadline, uint256 fundingDeadline);
    event PythMarketRegistered(bytes32 indexed marketId, bytes32 priceFeedId, int64 targetPrice, bool resolveAbove);
    event MarketPreDepositCreated(bytes32 indexed marketId, address indexed creator, uint256 amount);
    event MarketFunded(bytes32 indexed marketId, address indexed creator, uint256 amount);
    event MarketResolved(bytes32 indexed marketId, bool winningIsYes);
    event MarketVoided(bytes32 indexed marketId);
    event OptimisticResolverUpdated(address resolver);

    // ─── Errors ──────────────────────────────────────────────────────────
    error Unauthorized();
    error MarketAlreadyRegistered();
    error MarketNotRegistered();
    error MarketAlreadyFunded();
    error MarketAlreadyResolved();
    error MarketAlreadyVoided();
    error NotCreator();
    error DeadlineInPast();
    error ZeroAmount();
    error InsufficientCreatorDeposit();
    error NotPythMarket();
    error DeadlineNotReached();
    error InsufficientFee();

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _fpmm, address _vault, address _usdc, address _pyth) {
        fpmm = VerityFPMM(_fpmm);
        vault = ConditionalTokenVault(_vault);
        usdc = IERC20(_usdc);
        pyth = IPyth(_pyth);
        admin = msg.sender;
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    function setOptimisticResolver(address _resolver) external onlyAdmin {
        optimisticResolver = _resolver;
        emit OptimisticResolverUpdated(_resolver);
    }

    // ─── Market Registration ─────────────────────────────────────────────

    /// @notice Creator deposits initial LP and pays the creation fee to treasury.
    /// @param marketId Unique market identifier
    /// @param creatorLpAmount Amount of USDC to deposit as initial LP
    function createMarketPreDeposit(bytes32 marketId, uint256 creatorLpAmount) external {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.creator != address(0)) revert MarketAlreadyRegistered();
        if (creatorLpAmount < fpmm.CREATOR_MIN_LOCK()) revert InsufficientCreatorDeposit();

        // 1 USDC creation fee
        uint256 fee = 1e6;

        // Pull 1 USDC fee + creator LP from creator
        usdc.safeTransferFrom(msg.sender, address(this), fee + creatorLpAmount);

        // Send fee to fpmm's treasury
        usdc.safeTransfer(fpmm.treasury(), fee);

        preMarketDeposits[marketId][msg.sender] += creatorLpAmount;

        escrowBalances[marketId] = creatorLpAmount;
        info.creator = msg.sender;

        emit MarketPreDepositCreated(marketId, msg.sender, creatorLpAmount);
    }

    /// @notice Creator deposits initial LP and pays the creation fee to treasury on behalf of a beneficiary.
    /// @param marketId Unique market identifier
    /// @param beneficiary The address that will own the creator LP and creator privileges
    /// @param creatorLpAmount Amount of USDC to deposit as initial LP
    function createMarketPreDepositFor(bytes32 marketId, address beneficiary, uint256 creatorLpAmount) external {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.creator != address(0)) revert MarketAlreadyRegistered();
        if (creatorLpAmount < fpmm.CREATOR_MIN_LOCK()) revert InsufficientCreatorDeposit();

        // 1 USDC creation fee
        uint256 fee = 1e6;

        // Pull 1 USDC fee + creator LP from caller
        usdc.safeTransferFrom(msg.sender, address(this), fee + creatorLpAmount);

        // Send fee to fpmm's treasury
        usdc.safeTransfer(fpmm.treasury(), fee);

        preMarketDeposits[marketId][beneficiary] += creatorLpAmount;

        escrowBalances[marketId] = creatorLpAmount;
        info.creator = beneficiary;

        emit MarketPreDepositCreated(marketId, beneficiary, creatorLpAmount);
    }


    /// @notice Register a new market after social qualification. Called by admin (backend).
    /// @param marketId Unique market identifier (e.g., keccak256 of MongoDB market ID)
    /// @param creator Wallet address of the market creator
    /// @param deadline Trading deadline timestamp
    /// @param fundingDeadline Timestamp by which pool must reach MIN_POOL_BALANCE
    function registerMarket(
        bytes32 marketId,
        address creator,
        uint256 deadline,
        uint256 fundingDeadline
    ) external onlyAdmin {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.registered) revert MarketAlreadyRegistered();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (fundingDeadline <= block.timestamp) revert DeadlineInPast();
        
        if (info.creator == address(0)) {
            info.creator = creator;
        } else if (info.creator != creator) {
            revert NotCreator();
        }

        info.deadline = deadline;
        info.fundingDeadline = fundingDeadline;
        info.registered = true;

        allMarketIds.push(marketId);

        emit MarketRegistered(marketId, creator, deadline, fundingDeadline);

        // Deploy pool if escrow balance >= MIN_POOL_BALANCE
        if (escrowBalances[marketId] >= fpmm.MIN_POOL_BALANCE()) {
            info.funded = true;
            uint256 totalUsdc = escrowBalances[marketId];
            usdc.approve(address(fpmm), totalUsdc);
            fpmm.createPool(marketId);
            emit MarketFunded(marketId, creator, totalUsdc);
        }
    }

    /// @notice Register a new market resolved via Pyth price feeds. Called by admin (backend).
    /// @param marketId Unique market identifier
    /// @param creator Wallet address of the market creator
    /// @param deadline Trading deadline timestamp
    /// @param fundingDeadline Timestamp by which pool must reach MIN_POOL_BALANCE
    /// @param priceFeedId Pyth price feed ID
    /// @param targetPrice Threshold price value for YES outcome
    /// @param resolveAbove true if YES resolves when price >= targetPrice, false if YES resolves when price < targetPrice
    function registerPythMarket(
        bytes32 marketId,
        address creator,
        uint256 deadline,
        uint256 fundingDeadline,
        bytes32 priceFeedId,
        int64 targetPrice,
        bool resolveAbove
    ) external onlyAdmin {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.registered) revert MarketAlreadyRegistered();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (fundingDeadline <= block.timestamp) revert DeadlineInPast();
        
        if (info.creator == address(0)) {
            info.creator = creator;
        } else if (info.creator != creator) {
            revert NotCreator();
        }

        info.deadline = deadline;
        info.fundingDeadline = fundingDeadline;
        info.registered = true;

        pythMarkets[marketId] = PythMarketParams({
            priceFeedId: priceFeedId,
            targetPrice: targetPrice,
            resolveAbove: resolveAbove,
            isPythMarket: true
        });

        allMarketIds.push(marketId);

        emit MarketRegistered(marketId, creator, deadline, fundingDeadline);
        emit PythMarketRegistered(marketId, priceFeedId, targetPrice, resolveAbove);

        // Deploy pool if escrow balance >= MIN_POOL_BALANCE
        if (escrowBalances[marketId] >= fpmm.MIN_POOL_BALANCE()) {
            info.funded = true;
            uint256 totalUsdc = escrowBalances[marketId];
            usdc.approve(address(fpmm), totalUsdc);
            fpmm.createPool(marketId);
            emit MarketFunded(marketId, creator, totalUsdc);
        }
    }

    // ─── Pre-Market Funding (Escrow) ─────────────────────────────────────

    /// @notice Public LPs and Creator deposit USDC before the market is active.
    /// @dev Pulls USDC and holds it in escrow. Triggers deployment if threshold is reached.
    /// @param marketId Market identifier
    /// @param amount Amount of USDC to deposit
    function depositPreMarketLiquidity(bytes32 marketId, uint256 amount) external {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.funded) revert MarketAlreadyFunded();
        if (info.voided) revert MarketAlreadyVoided();
        if (amount == 0) revert ZeroAmount();

        // The creator must have made the pre-deposit first
        if (info.creator == address(0)) revert NotCreator();

        // If registered, check funding deadline
        if (info.registered && block.timestamp > info.fundingDeadline) revert DeadlineInPast();

        // Pull USDC to this factory contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        preMarketDeposits[marketId][msg.sender] += amount;
        
        escrowBalances[marketId] += amount;

        // Trigger pool creation if minimum threshold is met AND the market is registered
        if (info.registered && escrowBalances[marketId] >= fpmm.MIN_POOL_BALANCE()) {
            info.funded = true;

            uint256 totalUsdc = escrowBalances[marketId];
            
            // Approve FPMM to pull the bundled USDC
            usdc.approve(address(fpmm), totalUsdc);

            // Deploy the pool automatically
            fpmm.createPool(marketId);

            emit MarketFunded(marketId, info.creator, totalUsdc);
        }
    }

    /// @notice Public LPs and Creator deposit USDC before the market is active on behalf of a beneficiary.
    /// @param marketId Market identifier
    /// @param beneficiary The address that will own the deposited LP position
    /// @param amount Amount of USDC to deposit
    function depositPreMarketLiquidityFor(bytes32 marketId, address beneficiary, uint256 amount) external {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.funded) revert MarketAlreadyFunded();
        if (info.voided) revert MarketAlreadyVoided();
        if (amount == 0) revert ZeroAmount();

        // The creator must have made the pre-deposit first
        if (info.creator == address(0)) revert NotCreator();

        // If registered, check funding deadline
        if (info.registered && block.timestamp > info.fundingDeadline) revert DeadlineInPast();

        // Pull USDC to this factory contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        preMarketDeposits[marketId][beneficiary] += amount;
        
        escrowBalances[marketId] += amount;

        // Trigger pool creation if minimum threshold is met AND the market is registered
        if (info.registered && escrowBalances[marketId] >= fpmm.MIN_POOL_BALANCE()) {
            info.funded = true;

            uint256 totalUsdc = escrowBalances[marketId];
            
            // Approve FPMM to pull the bundled USDC
            usdc.approve(address(fpmm), totalUsdc);

            // Deploy the pool automatically
            fpmm.createPool(marketId);

            emit MarketFunded(marketId, info.creator, totalUsdc);
        }
    }


    /// @notice Refund pre-market deposits if the market was voided (funding failed)
    /// @param marketId Market identifier
    function claimRefund(bytes32 marketId) external {
        MarketInfo storage info = marketRegistry[marketId];
        if (!info.voided) revert MarketNotRegistered();

        uint256 refundAmount = preMarketDeposits[marketId][msg.sender];
        if (refundAmount == 0) revert ZeroAmount();

        preMarketDeposits[marketId][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, refundAmount);
    }

    // ─── Resolution ──────────────────────────────────────────────────────

    /// @notice Admin resolves a market by setting the winning outcome.
    /// @param marketId Market identifier
    /// @param winningIsYes true if YES wins, false if NO wins
    function resolveMarket(bytes32 marketId, bool winningIsYes) external onlyAdmin {
        MarketInfo storage info = marketRegistry[marketId];
        if (!info.registered) revert MarketNotRegistered();
        if (info.resolved) revert MarketAlreadyResolved();
        if (info.voided) revert MarketAlreadyVoided();

        info.resolved = true;

        // Resolve on the vault (sets winning side for redemptions)
        vault.resolve(marketId, winningIsYes);

        // Mark pool as resolved on FPMM (allows creator withdrawal)
        fpmm.markResolved(marketId);

        emit MarketResolved(marketId, winningIsYes);
    }

    /// @notice Admin resolves a Pyth-registered market using historical cryptographic price updates.
    /// @param marketId Market identifier
    /// @param priceUpdate Signed price update VAAs from Pyth Hermes API
    function resolveMarketWithPyth(bytes32 marketId, bytes[] calldata priceUpdate) external payable onlyAdmin {
        MarketInfo storage info = marketRegistry[marketId];
        PythMarketParams storage pythParams = pythMarkets[marketId];

        if (!info.registered) revert MarketNotRegistered();
        if (info.resolved) revert MarketAlreadyResolved();
        if (info.voided) revert MarketAlreadyVoided();
        if (!pythParams.isPythMarket) revert NotPythMarket();
        if (block.timestamp <= info.deadline) revert DeadlineNotReached();

        // Verify price update and fetch the historical price
        uint256 fee = pyth.getUpdateFee(priceUpdate);
        if (msg.value < fee) revert InsufficientFee();

        // Wrap priceFeedId in an array to match IPyth interface
        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = pythParams.priceFeedId;

        // Parse price update for the exact deadline timestamp (+/- 60 seconds margin)
        PythStructs.PriceFeed[] memory priceFeeds = pyth.parsePriceFeedUpdates{value: fee}(
            priceUpdate,
            priceIds,
            uint64(info.deadline - 60),
            uint64(info.deadline + 60)
        );

        PythStructs.Price memory price = priceFeeds[0].price;

        bool winningIsYes;
        if (pythParams.resolveAbove) {
            winningIsYes = (price.price >= pythParams.targetPrice);
        } else {
            winningIsYes = (price.price < pythParams.targetPrice);
        }

        info.resolved = true;
        vault.resolve(marketId, winningIsYes);
        fpmm.markResolved(marketId);

        // Refund excess ETH
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }

        emit MarketResolved(marketId, winningIsYes);
    }

    /// @notice Resolution callback triggered by the authorized optimistic resolver contract.
    function resolveMarketFromResolver(bytes32 marketId, bool winningIsYes) external {
        if (msg.sender != optimisticResolver) revert Unauthorized();
        MarketInfo storage info = marketRegistry[marketId];
        if (!info.registered) revert MarketNotRegistered();
        if (info.resolved) revert MarketAlreadyResolved();
        if (info.voided) revert MarketAlreadyVoided();

        info.resolved = true;
        vault.resolve(marketId, winningIsYes);
        fpmm.markResolved(marketId);
        emit MarketResolved(marketId, winningIsYes);
    }

    // ─── Void / Auto-Void ────────────────────────────────────────────────

    /// @notice Void a market. Used for unfunded markets past deadline or ambiguous outcomes.
    /// @param marketId Market identifier
    function voidMarket(bytes32 marketId) external onlyAdmin {
        MarketInfo storage info = marketRegistry[marketId];
        if (info.creator == address(0)) revert MarketNotRegistered();
        if (info.resolved) revert MarketAlreadyResolved();
        if (info.voided) revert MarketAlreadyVoided();

        info.voided = true;

        // If the pool was funded but not active (didn't reach threshold),
        // we need to allow LPs to withdraw their tokens.
        // Mark as resolved so all LPs (including creator) can withdraw.
        if (info.funded) {
            fpmm.markResolved(marketId);
        }

        emit MarketVoided(marketId);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    function claimPreMarketDeposit(bytes32 marketId, address user) external returns (uint256) {
        if (msg.sender != address(fpmm)) revert Unauthorized();
        uint256 amount = preMarketDeposits[marketId][user];
        if (amount > 0) {
            preMarketDeposits[marketId][user] = 0;
        }
        return amount;
    }

    function getMarketCount() external view returns (uint256) {
        return allMarketIds.length;
    }

    function isMarketActive(bytes32 marketId) external view returns (bool) {
        MarketInfo storage info = marketRegistry[marketId];
        return info.registered && info.funded && !info.resolved && !info.voided;
    }

    function isFundingExpired(bytes32 marketId) external view returns (bool) {
        MarketInfo storage info = marketRegistry[marketId];
        return info.registered && !info.funded && block.timestamp > info.fundingDeadline;
    }
}
