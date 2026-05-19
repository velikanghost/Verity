// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ConditionalTokenVault
/// @notice ERC1155 vault that mints/burns YES+NO outcome tokens for prediction markets,
///         backed 1:1 by USDC collateral. One contract manages all markets.
contract ConditionalTokenVault is ERC1155 {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    address public admin;
    address public fpmm;     // Authorized VerityFPMM contract
    address public factory;  // Authorized VerityMarketFactory contract

    struct MarketOutcome {
        bool resolved;
        bool winningIsYes;
        uint256 totalCollateral; // Total USDC locked for this market
    }

    mapping(bytes32 => MarketOutcome) public markets;

    // Track total supply per token ID (ERC1155 doesn't track this natively)
    mapping(uint256 => uint256) public totalSupply;

    // ─── Events ──────────────────────────────────────────────────────────
    event PairMinted(bytes32 indexed marketId, address indexed to, uint256 amount);
    event PairBurned(bytes32 indexed marketId, address indexed from, uint256 amount);
    event MarketResolved(bytes32 indexed marketId, bool winningIsYes);
    event WinningsRedeemed(bytes32 indexed marketId, address indexed user, uint256 tokens, uint256 usdcPayout);

    // ─── Errors ──────────────────────────────────────────────────────────
    error Unauthorized();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InsufficientBalance();
    error ZeroAmount();

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyFPMM() {
        if (msg.sender != fpmm) revert Unauthorized();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _usdc) ERC1155("") {
        usdc = IERC20(_usdc);
        admin = msg.sender;
    }

    // ─── Admin Setup ─────────────────────────────────────────────────────
    function setFPMM(address _fpmm) external onlyAdmin {
        fpmm = _fpmm;
    }

    function setFactory(address _factory) external onlyAdmin {
        factory = _factory;
    }

    function transferAdmin(address _newAdmin) external onlyAdmin {
        admin = _newAdmin;
    }

    // ─── Token ID Helpers ────────────────────────────────────────────────
    function yesTokenId(bytes32 marketId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(marketId, "YES")));
    }

    function noTokenId(bytes32 marketId) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(marketId, "NO")));
    }

    // ─── Core Functions ──────────────────────────────────────────────────

    /// @notice Lock USDC and mint equal YES + NO tokens. Called by FPMM.
    /// @dev Caller (FPMM) must have already transferred USDC to this contract,
    ///      or `from` must have approved this contract for the USDC amount.
    /// @param marketId The market identifier
    /// @param to Address to receive the minted tokens
    /// @param amount Number of token pairs to mint (in USDC base units, 6 decimals)
    function mintPair(bytes32 marketId, address to, uint256 amount) external onlyFPMM {
        if (amount == 0) revert ZeroAmount();
        if (markets[marketId].resolved) revert MarketAlreadyResolved();

        // Pull USDC from the caller (FPMM contract)
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Update collateral tracking
        markets[marketId].totalCollateral += amount;

        // Mint YES and NO tokens
        uint256 yesId = yesTokenId(marketId);
        uint256 noId = noTokenId(marketId);

        _mint(to, yesId, amount, "");
        _mint(to, noId, amount, "");

        totalSupply[yesId] += amount;
        totalSupply[noId] += amount;

        emit PairMinted(marketId, to, amount);
    }

    /// @notice Burn equal YES + NO tokens and release USDC. Called by FPMM.
    /// @param marketId The market identifier
    /// @param from Address to burn tokens from (must have approved this contract)
    /// @param amount Number of token pairs to burn
    function burnPair(bytes32 marketId, address from, uint256 amount) external onlyFPMM {
        if (amount == 0) revert ZeroAmount();
        if (markets[marketId].resolved) revert MarketAlreadyResolved();

        uint256 yesId = yesTokenId(marketId);
        uint256 noId = noTokenId(marketId);

        // Verify balances
        if (balanceOf(from, yesId) < amount || balanceOf(from, noId) < amount) {
            revert InsufficientBalance();
        }

        // Burn tokens
        _burn(from, yesId, amount);
        _burn(from, noId, amount);

        totalSupply[yesId] -= amount;
        totalSupply[noId] -= amount;

        // Release USDC
        markets[marketId].totalCollateral -= amount;
        usdc.safeTransfer(from, amount);

        emit PairBurned(marketId, from, amount);
    }

    /// @notice Set the winning outcome for a market. Called by Factory (admin).
    /// @param marketId The market identifier
    /// @param winningIsYes true if YES wins, false if NO wins
    function resolve(bytes32 marketId, bool winningIsYes) external onlyFactory {
        MarketOutcome storage outcome = markets[marketId];
        if (outcome.resolved) revert MarketAlreadyResolved();

        outcome.resolved = true;
        outcome.winningIsYes = winningIsYes;

        emit MarketResolved(marketId, winningIsYes);
    }

    /// @notice After resolution, burn winning tokens and receive 1 USDC per token.
    /// @param marketId The market identifier
    function redeem(bytes32 marketId) external {
        MarketOutcome storage outcome = markets[marketId];
        if (!outcome.resolved) revert MarketNotResolved();

        uint256 winningId = outcome.winningIsYes
            ? yesTokenId(marketId)
            : noTokenId(marketId);

        uint256 userBalance = balanceOf(msg.sender, winningId);
        if (userBalance == 0) revert InsufficientBalance();

        // Burn the winning tokens
        _burn(msg.sender, winningId, userBalance);
        totalSupply[winningId] -= userBalance;

        // Reduce collateral and pay out
        outcome.totalCollateral -= userBalance;
        usdc.safeTransfer(msg.sender, userBalance);

        emit WinningsRedeemed(marketId, msg.sender, userBalance, userBalance);
    }

    // ─── View Helpers ────────────────────────────────────────────────────

    function isResolved(bytes32 marketId) external view returns (bool) {
        return markets[marketId].resolved;
    }

    function getCollateral(bytes32 marketId) external view returns (uint256) {
        return markets[marketId].totalCollateral;
    }
}
