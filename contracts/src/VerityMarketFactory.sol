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
    mapping(bytes32 => PreMarketDeposit[]) public preMarketDeposits;
    mapping(bytes32 => uint256) public escrowBalances;
    bytes32[] public allMarketIds;

    // ─── Events ──────────────────────────────────────────────────────────
    event MarketRegistered(bytes32 indexed marketId, address indexed creator, uint256 deadline, uint256 fundingDeadline);
    event PythMarketRegistered(bytes32 indexed marketId, bytes32 priceFeedId, int64 targetPrice, bool resolveAbove);
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
        if (marketRegistry[marketId].registered) revert MarketAlreadyRegistered();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (fundingDeadline <= block.timestamp) revert DeadlineInPast();

        marketRegistry[marketId] = MarketInfo({
            creator: creator,
            deadline: deadline,
            fundingDeadline: fundingDeadline,
            registered: true,
            funded: false,
            resolved: false,
            voided: false
        });

        allMarketIds.push(marketId);

        emit MarketRegistered(marketId, creator, deadline, fundingDeadline);
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
        if (marketRegistry[marketId].registered) revert MarketAlreadyRegistered();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (fundingDeadline <= block.timestamp) revert DeadlineInPast();

        marketRegistry[marketId] = MarketInfo({
            creator: creator,
            deadline: deadline,
            fundingDeadline: fundingDeadline,
            registered: true,
            funded: false,
            resolved: false,
            voided: false
        });

        pythMarkets[marketId] = PythMarketParams({
            priceFeedId: priceFeedId,
            targetPrice: targetPrice,
            resolveAbove: resolveAbove,
            isPythMarket: true
        });

        allMarketIds.push(marketId);

        emit MarketRegistered(marketId, creator, deadline, fundingDeadline);
        emit PythMarketRegistered(marketId, priceFeedId, targetPrice, resolveAbove);
    }

    // ─── Pre-Market Funding (Escrow) ─────────────────────────────────────

    /// @notice Public LPs and Creator deposit USDC before the market is active.
    /// @dev Pulls USDC and holds it in escrow. Triggers deployment if threshold is reached.
    /// @param marketId Market identifier
    /// @param amount Amount of USDC to deposit
    function depositPreMarketLiquidity(bytes32 marketId, uint256 amount) external {
        MarketInfo storage info = marketRegistry[marketId];
        if (!info.registered) revert MarketNotRegistered();
        if (info.funded) revert MarketAlreadyFunded();
        if (info.voided) revert MarketAlreadyVoided();
        if (block.timestamp > info.fundingDeadline) revert DeadlineInPast();
        if (amount == 0) revert ZeroAmount();

        // The creator must make the first deposit, and it must meet the minimum lock
        if (preMarketDeposits[marketId].length == 0) {
            if (msg.sender != info.creator) revert NotCreator();
            if (amount < fpmm.CREATOR_MIN_LOCK()) revert InsufficientCreatorDeposit();
        }

        // Pull USDC to this factory contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        preMarketDeposits[marketId].push(PreMarketDeposit({
            lp: msg.sender,
            amount: amount
        }));
        
        escrowBalances[marketId] += amount;

        // Trigger pool creation if minimum threshold is met
        if (escrowBalances[marketId] >= fpmm.MIN_POOL_BALANCE()) {
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

        uint256 refundAmount = 0;
        PreMarketDeposit[] storage deposits = preMarketDeposits[marketId];
        
        for (uint256 i = 0; i < deposits.length; i++) {
            if (deposits[i].lp == msg.sender) {
                refundAmount += deposits[i].amount;
                deposits[i].amount = 0; // Prevent double refund
            }
        }

        if (refundAmount == 0) revert ZeroAmount();
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
        if (!info.registered) revert MarketNotRegistered();
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

    function getPreMarketDepositCount(bytes32 marketId) external view returns (uint256) {
        return preMarketDeposits[marketId].length;
    }

    function getPreMarketDeposit(bytes32 marketId, uint256 index) external view returns (address lp, uint256 amount) {
        PreMarketDeposit memory dep = preMarketDeposits[marketId][index];
        return (dep.lp, dep.amount);
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
