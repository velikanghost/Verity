// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ConditionalTokenVault.sol";
import "../src/VerityFPMM.sol";
import "../src/VerityMarketFactory.sol";
import "./helpers/MockUSDC.sol";

/// @title ConditionalTokenVaultTest
contract ConditionalTokenVaultTest is Test {
    MockUSDC usdc;
    ConditionalTokenVault vault;
    VerityFPMM fpmm;
    VerityMarketFactory factory;

    address admin = address(this);
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address trader = makeAddr("trader");

    bytes32 marketId = keccak256("market-1");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new ConditionalTokenVault(address(usdc));
        fpmm = new VerityFPMM(address(vault), address(usdc), treasury);
        factory = new VerityMarketFactory(address(fpmm), address(vault), address(usdc));

        // Wire up permissions
        vault.setFPMM(address(fpmm));
        vault.setFactory(address(factory));
        fpmm.setFactory(address(factory));

        // Mint USDC to test accounts
        usdc.mint(creator, 1000e6);
        usdc.mint(trader, 1000e6);

        // Approvals
        vm.startPrank(creator);
        usdc.approve(address(fpmm), type(uint256).max);
        usdc.approve(address(factory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(address(fpmm), type(uint256).max);
        usdc.approve(address(factory), type(uint256).max);
        vm.stopPrank();
    }

    // ─── Token ID Tests ──────────────────────────────────────────────────

    function test_tokenIdsAreUnique() public view {
        uint256 yesId = vault.yesTokenId(marketId);
        uint256 noId = vault.noTokenId(marketId);
        assertTrue(yesId != noId, "YES and NO token IDs must differ");
    }

    function test_tokenIdsAreDeterministic() public view {
        uint256 yesId1 = vault.yesTokenId(marketId);
        uint256 yesId2 = vault.yesTokenId(marketId);
        assertEq(yesId1, yesId2, "Token IDs must be deterministic");
    }

    function test_differentMarketsHaveDifferentTokenIds() public view {
        bytes32 marketId2 = keccak256("market-2");
        uint256 yesId1 = vault.yesTokenId(marketId);
        uint256 yesId2 = vault.yesTokenId(marketId2);
        assertTrue(yesId1 != yesId2, "Different markets must have different token IDs");
    }

    // ─── MintPair Tests ──────────────────────────────────────────────────

    function test_mintPairLocksUsdcAndMintsTokens() public {
        // Setup: register + fund pool (which triggers mintPair internally)
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);

        // The FPMM contract should now hold YES and NO tokens
        uint256 yesId = vault.yesTokenId(marketId);
        uint256 noId = vault.noTokenId(marketId);

        assertTrue(vault.balanceOf(address(fpmm), yesId) > 0, "FPMM should hold YES tokens");
        assertTrue(vault.balanceOf(address(fpmm), noId) > 0, "FPMM should hold NO tokens");
        assertEq(vault.getCollateral(marketId), 40e6, "Collateral should equal deposited USDC");
    }

    function test_mintPairRevertsIfUnauthorized() public {
        usdc.mint(address(this), 100e6);
        usdc.approve(address(vault), 100e6);

        vm.expectRevert(ConditionalTokenVault.Unauthorized.selector);
        vault.mintPair(marketId, address(this), 100e6);
    }

    function test_mintPairRevertsOnZeroAmount() public {
        // We need to call via FPMM, which is the authorized caller
        // But FPMM.createPool checks for minimum deposit, so this test
        // validates the vault-level check indirectly
        // Direct test: prank as FPMM
        vm.prank(address(fpmm));
        vm.expectRevert(ConditionalTokenVault.ZeroAmount.selector);
        vault.mintPair(marketId, address(this), 0);
    }

    // ─── BurnPair Tests ──────────────────────────────────────────────────

    function test_burnPairRevertsIfUnauthorized() public {
        vm.expectRevert(ConditionalTokenVault.Unauthorized.selector);
        vault.burnPair(marketId, address(this), 100e6);
    }

    // ─── Resolution Tests ────────────────────────────────────────────────

    function test_resolveSetWinningSide() public {
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);

        factory.resolveMarket(marketId, true);

        assertTrue(vault.isResolved(marketId), "Market should be resolved");
        (bool resolved, bool winningIsYes,) = vault.markets(marketId);
        assertTrue(resolved, "Should be resolved");
        assertTrue(winningIsYes, "YES should be winning");
    }

    function test_resolveRevertsOnDoubleCa() public {
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);

        factory.resolveMarket(marketId, true);

        vm.expectRevert(VerityMarketFactory.MarketAlreadyResolved.selector);
        factory.resolveMarket(marketId, false);
    }

    function test_resolveRevertsIfNotFactory() public {
        vm.expectRevert(ConditionalTokenVault.Unauthorized.selector);
        vault.resolve(marketId, true);
    }

    // ─── Redemption Tests ────────────────────────────────────────────────

    function test_redeemPaysWinningTokenHolders() public {
        // Setup: create pool, buy YES tokens, resolve YES wins, redeem
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);

        // Trader buys YES tokens
        vm.prank(trader);
        uint256 tokensReceived = fpmm.buy(marketId, true, 10e6);
        assertTrue(tokensReceived > 0, "Should receive tokens");

        // Resolve: YES wins
        factory.resolveMarket(marketId, true);

        // Redeem
        uint256 yesId = vault.yesTokenId(marketId);
        uint256 traderYesBalance = vault.balanceOf(trader, yesId);
        assertTrue(traderYesBalance > 0, "Trader should hold YES tokens");

        uint256 usdcBefore = usdc.balanceOf(trader);
        vm.prank(trader);
        vault.redeem(marketId);
        uint256 usdcAfter = usdc.balanceOf(trader);

        assertEq(usdcAfter - usdcBefore, traderYesBalance, "Should receive 1 USDC per winning token");
        assertEq(vault.balanceOf(trader, yesId), 0, "Winning tokens should be burned");
    }

    function test_redeemRevertsBeforeResolution() public {
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);

        // Buy tokens
        vm.prank(trader);
        fpmm.buy(marketId, true, 10e6);

        // Try to redeem before resolution
        vm.prank(trader);
        vm.expectRevert(ConditionalTokenVault.MarketNotResolved.selector);
        vault.redeem(marketId);
    }

    function test_redeemRevertsIfNoWinningTokens() public {
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);

        // Buy YES tokens
        vm.prank(trader);
        fpmm.buy(marketId, true, 10e6);

        // Resolve: NO wins
        factory.resolveMarket(marketId, false);

        // Trader holds YES tokens but NO wins — should revert
        vm.prank(trader);
        vm.expectRevert(ConditionalTokenVault.InsufficientBalance.selector);
        vault.redeem(marketId);
    }
}
