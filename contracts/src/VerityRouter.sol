// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./VerityFPMM.sol";
import "./VerityMarketFactory.sol";
import "./ConditionalTokenVault.sol";
import "./VerityOptimisticResolver.sol";

contract VerityRouter is ERC1155Holder {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    ConditionalTokenVault public immutable vault;

    constructor(address _usdc, address _vault) {
        usdc = IERC20(_usdc);
        vault = ConditionalTokenVault(_vault);
    }

    /// @notice Creator deposits pre-market LP and fee via Router
    function createMarketPreDeposit(
        address factory,
        bytes32 marketId,
        uint256 creatorLpAmount
    ) external {
        uint256 totalNeeded = 1e6 + creatorLpAmount; // 1 USDC fee + creator LP
        
        // 1. Pull USDC from the user to the Router
        usdc.safeTransferFrom(msg.sender, address(this), totalNeeded);
        
        // 2. Approve the Factory to spend it
        usdc.approve(factory, 0);
        usdc.approve(factory, totalNeeded);
        
        // 3. Call the Factory on behalf of the user
        VerityMarketFactory(factory).createMarketPreDepositFor(marketId, msg.sender, creatorLpAmount);
    }

    /// @notice Public LP deposits pre-market liquidity via Router
    function depositPreMarketLiquidity(
        address factory,
        bytes32 marketId,
        uint256 amount
    ) external {
        // 1. Pull USDC from the user to the Router
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        // 2. Approve the Factory to spend it
        usdc.approve(factory, 0);
        usdc.approve(factory, amount);
        
        // 3. Call the Factory on behalf of the user
        VerityMarketFactory(factory).depositPreMarketLiquidityFor(marketId, msg.sender, amount);
    }

    /// @notice Buy outcome tokens in one click
    function buy(
        address fpmm,
        bytes32 marketId,
        bool isYes,
        uint256 usdcAmount
    ) external returns (uint256 tokensOut) {
        // 1. Pull USDC from the user to the Router
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // 2. Approve the FPMM contract to spend it
        usdc.approve(fpmm, 0);
        usdc.approve(fpmm, usdcAmount);
        
        // 3. Buy tokens (the FPMM transfers yes/no tokens to the Router)
        tokensOut = VerityFPMM(fpmm).buy(marketId, isYes, usdcAmount);
        
        // 4. Transfer the purchased yes/no tokens back to the user
        uint256 tokenId = isYes ? vault.yesTokenId(marketId) : vault.noTokenId(marketId);
        vault.safeTransferFrom(address(this), msg.sender, tokenId, tokensOut, "");
    }

    /// @notice Public LP adds liquidity via Router
    function addLiquidity(
        address fpmm,
        bytes32 marketId,
        uint256 usdcAmount
    ) external {
        // 1. Pull USDC from the user to the Router
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        
        // 2. Approve the FPMM contract to spend it
        usdc.approve(fpmm, 0);
        usdc.approve(fpmm, usdcAmount);
        
        // 3. Deposit LP on behalf of the user
        VerityFPMM(fpmm).addLiquidityFor(marketId, msg.sender, usdcAmount);
    }

    /// @notice Propose a market resolution via Router
    function proposeResolution(
        address resolver,
        bytes32 marketId,
        bool proposedOutcome
    ) external {
        uint256 bond = VerityOptimisticResolver(resolver).resolutionBond();

        // 1. Pull USDC from the user to the Router
        usdc.safeTransferFrom(msg.sender, address(this), bond);

        // 2. Approve the Resolver to spend it
        usdc.approve(resolver, 0);
        usdc.approve(resolver, bond);

        // 3. Propose resolution on behalf of the user
        VerityOptimisticResolver(resolver).proposeResolutionFor(marketId, msg.sender, proposedOutcome);
    }

    /// @notice Dispute a proposed market resolution via Router
    function disputeResolution(
        address resolver,
        bytes32 marketId
    ) external {
        uint256 bond = VerityOptimisticResolver(resolver).resolutionBond();

        // 1. Pull USDC from the user to the Router
        usdc.safeTransferFrom(msg.sender, address(this), bond);

        // 2. Approve the Resolver to spend it
        usdc.approve(resolver, 0);
        usdc.approve(resolver, bond);

        // 3. Dispute resolution on behalf of the user
        VerityOptimisticResolver(resolver).disputeResolutionFor(marketId, msg.sender);
    }
}

