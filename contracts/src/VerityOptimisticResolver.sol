// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./VerityMarketFactory.sol";

contract VerityOptimisticResolver {
    using SafeERC20 for IERC20;

    // ─── Structs ──────────────────────────────────────────────────────────
    struct Proposal {
        address proposer;
        bool proposedWinningOutcome;
        uint256 proposalTime;
        bool disputed;
        address disputer;
        bool finalized;
    }

    // ─── State ───────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    VerityMarketFactory public immutable factory;
    address public arbitrator;

    uint256 public disputeWindow = 2 minutes;
    uint256 public resolutionBond = 10 * 10 ** 6; // 10 USDC

    mapping(bytes32 => Proposal) public proposals;

    // ─── Events ──────────────────────────────────────────────────────────
    event ResolutionProposed(
        bytes32 indexed marketId,
        address indexed proposer,
        bool proposedOutcome,
        uint256 proposalTime
    );
    event ResolutionDisputed(
        bytes32 indexed marketId,
        address indexed disputer,
        uint256 disputeTime
    );
    event ResolutionFinalized(bytes32 indexed marketId, bool finalOutcome);
    event DisputeResolved(
        bytes32 indexed marketId,
        bool finalOutcome,
        address indexed winner,
        uint256 payoutAmount
    );
    event DisputeWindowUpdated(uint256 newWindow);
    event ResolutionBondUpdated(uint256 newBond);
    event ArbitratorUpdated(address indexed newArbitrator);

    // ─── Errors ──────────────────────────────────────────────────────────
    error Unauthorized();
    error MarketNotExpired();
    error MarketAlreadyResolved();
    error ProposalAlreadyExists();
    error ProposalDoesNotExist();
    error ProposalAlreadyDisputed();
    error ProposalAlreadyFinalized();
    error DisputeWindowActive();
    error DisputeWindowExpired();
    error DisputeNotActive();

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert Unauthorized();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _usdc, address _factory, address _arbitrator) {
        usdc = IERC20(_usdc);
        factory = VerityMarketFactory(_factory);
        arbitrator = _arbitrator;
    }

    // ─── Admin Config ────────────────────────────────────────────────────
    function setDisputeWindow(uint256 _window) external onlyArbitrator {
        disputeWindow = _window;
        emit DisputeWindowUpdated(_window);
    }

    function setResolutionBond(uint256 _bond) external onlyArbitrator {
        resolutionBond = _bond;
        emit ResolutionBondUpdated(_bond);
    }

    function setArbitrator(address _arbitrator) external onlyArbitrator {
        arbitrator = _arbitrator;
        emit ArbitratorUpdated(_arbitrator);
    }

    // ─── Core Flow ───────────────────────────────────────────────────────

    /// @notice Propose the resolution outcome of an expired market by posting a bond.
    function proposeResolution(
        bytes32 marketId,
        bool proposedOutcome
    ) external {
        // Retrieve market deadline
        (
            ,
            uint256 deadline,
            ,
            bool registered,
            ,
            bool resolved,
            bool voided
        ) = factory.marketRegistry(marketId);

        if (!registered) revert ProposalDoesNotExist(); // Or market not registered
        if (resolved || voided) revert MarketAlreadyResolved();
        if (block.timestamp <= deadline) revert MarketNotExpired();

        Proposal storage prop = proposals[marketId];
        if (prop.proposer != address(0)) revert ProposalAlreadyExists();

        // Lock proposer's bond
        usdc.safeTransferFrom(msg.sender, address(this), resolutionBond);

        proposals[marketId] = Proposal({
            proposer: msg.sender,
            proposedWinningOutcome: proposedOutcome,
            proposalTime: block.timestamp,
            disputed: false,
            disputer: address(0),
            finalized: false
        });

        emit ResolutionProposed(
            marketId,
            msg.sender,
            proposedOutcome,
            block.timestamp
        );
    }

    /// @notice Dispute an existing resolution proposal within the dispute window by posting a bond.
    function disputeResolution(bytes32 marketId) external {
        Proposal storage prop = proposals[marketId];
        if (prop.proposer == address(0)) revert ProposalDoesNotExist();
        if (prop.disputed) revert ProposalAlreadyDisputed();
        if (prop.finalized) revert ProposalAlreadyFinalized();
        if (block.timestamp > prop.proposalTime + disputeWindow)
            revert DisputeWindowExpired();

        // Lock disputer's bond
        usdc.safeTransferFrom(msg.sender, address(this), resolutionBond);

        prop.disputed = true;
        prop.disputer = msg.sender;

        emit ResolutionDisputed(marketId, msg.sender, block.timestamp);
    }

    /// @notice Finalize an undisputed proposal after the dispute window has elapsed.
    function finalizeResolution(bytes32 marketId) external {
        Proposal storage prop = proposals[marketId];
        if (prop.proposer == address(0)) revert ProposalDoesNotExist();
        if (prop.disputed) revert ProposalAlreadyDisputed();
        if (prop.finalized) revert ProposalAlreadyFinalized();
        if (block.timestamp <= prop.proposalTime + disputeWindow)
            revert DisputeWindowActive();

        prop.finalized = true;

        // Refund the proposer's bond
        usdc.safeTransfer(prop.proposer, resolutionBond);

        // Callback to factory to execute resolution
        factory.resolveMarketFromResolver(
            marketId,
            prop.proposedWinningOutcome
        );

        emit ResolutionFinalized(marketId, prop.proposedWinningOutcome);
    }

    /// @notice Arbitrator resolves a disputed proposal, determining final outcome and rewarding bonds.
    function resolveDisputedMarket(
        bytes32 marketId,
        bool winningIsYes
    ) external onlyArbitrator {
        Proposal storage prop = proposals[marketId];
        if (prop.proposer == address(0)) revert ProposalDoesNotExist();
        if (!prop.disputed) revert DisputeNotActive();
        if (prop.finalized) revert ProposalAlreadyFinalized();

        prop.finalized = true;

        address winner;
        uint256 payout = 2 * resolutionBond;

        if (winningIsYes == prop.proposedWinningOutcome) {
            // Proposer was correct
            winner = prop.proposer;
        } else {
            // Disputer was correct
            winner = prop.disputer;
        }

        // Transfer both bonds to the winner
        usdc.safeTransfer(winner, payout);

        // Callback to factory to execute resolution
        factory.resolveMarketFromResolver(marketId, winningIsYes);

        emit DisputeResolved(marketId, winningIsYes, winner, payout);
    }
}
