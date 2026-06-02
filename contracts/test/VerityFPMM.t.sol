// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ConditionalTokenVault.sol";
import "../src/VerityFPMM.sol";
import "../src/VerityMarketFactory.sol";
import "./helpers/MockUSDC.sol";
import "./helpers/MockPyth.sol";

/// @title VerityFPMMTest
contract VerityFPMMTest is Test {
    MockUSDC usdc;
    MockPyth pyth;
    ConditionalTokenVault vault;
    VerityFPMM fpmm;
    VerityMarketFactory factory;

    address admin = address(this);
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address lp1 = makeAddr("lp1");
    address lp2 = makeAddr("lp2");
    address trader = makeAddr("trader");

    bytes32 marketId = keccak256("market-1");

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();
        vault = new ConditionalTokenVault(address(usdc));
        fpmm = new VerityFPMM(address(vault), address(usdc), treasury);
        factory = new VerityMarketFactory(address(fpmm), address(vault), address(usdc), address(pyth));

        vault.setFPMM(address(fpmm));
        vault.setFactory(address(factory));
        fpmm.setFactory(address(factory));

        // Fund accounts
        usdc.mint(creator, 10_000e6);
        usdc.mint(lp1, 10_000e6);
        usdc.mint(lp2, 10_000e6);
        usdc.mint(trader, 10_000e6);

        // Approvals
        // Approvals
        vm.startPrank(creator);
        usdc.approve(address(fpmm), type(uint256).max);
        usdc.approve(address(factory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(lp1);
        usdc.approve(address(fpmm), type(uint256).max);
        usdc.approve(address(factory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(lp2);
        usdc.approve(address(fpmm), type(uint256).max);
        usdc.approve(address(factory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(trader);
        usdc.approve(address(fpmm), type(uint256).max);
        usdc.approve(address(factory), type(uint256).max);
        vm.stopPrank();
    }

    // ─── Helper: create & fund a market ──────────────────────────────────

    function _createActiveMarket() internal {
        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6); // 40 USDC immediately deploys it
        vm.prank(creator);
        fpmm.claimPreMarketLPShares(marketId);
    }

    // ─── Escrow & Pool Creation Tests ────────────────────────────────────

    function test_escrowAggregatesAndDeploys() public {
        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);
        
        // Creator deposits 10 USDC (minimum)
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 10e6);
        
        // Pool should NOT exist yet
        (,,,, bool active,) = fpmm.getPoolBalances(marketId);
        assertFalse(active);

        // LP1 deposits 30 USDC (pushes total to 40 USDC)
        vm.prank(lp1);
        factory.depositPreMarketLiquidity(marketId, 30e6);

        // Pool should now be active
        (uint256 yBal, uint256 nBal, uint256 totalShares, uint256 totalDep, bool activeAfter,) = fpmm.getPoolBalances(marketId);
        assertTrue(activeAfter, "Pool should be automatically deployed");
        assertEq(yBal, 40e6, "YES balance should be 40");
        assertEq(totalShares, 40e6, "Total shares should be 40");
        
        // Claim shares
        vm.prank(creator);
        fpmm.claimPreMarketLPShares(marketId);
        vm.prank(lp1);
        fpmm.claimPreMarketLPShares(marketId);
        
        // Check LP shares were distributed
        assertEq(fpmm.lpShares(marketId, creator), 0, "Creator deposited exactly 10, all of it is locked");
        assertEq(fpmm.lpShares(marketId, lp1), 30e6, "LP1 should get 30 shares");
        
        // Check locked creator shares
        (,,,uint256 creatorLocked,,,,,,) = fpmm.pools(marketId);
        assertEq(creatorLocked, 10e6, "Creator should have 10 locked shares");
    }

    function test_creatorEscrowMinimumEnforced() public {
        // Creator must deposit at least 10 USDC
        vm.prank(creator);
        vm.expectRevert(VerityMarketFactory.InsufficientCreatorDeposit.selector);
        factory.createMarketPreDeposit(marketId, 9e6);

        // Success deposit
        vm.prank(creator);
        factory.createMarketPreDeposit(marketId, 10e6);
        
        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);

        // Public LP can deposit
        vm.prank(lp1);
        factory.depositPreMarketLiquidity(marketId, 30e6);
    }

    function test_creatorSharesAreLocked() public {
        _createActiveMarket(); // Creator deposited 40 USDC

        // 10 USDC locked, 30 USDC normal shares
        uint256 creatorNormalShares = fpmm.lpShares(marketId, creator);
        assertEq(creatorNormalShares, 30e6, "Creator should have 30 normal shares");
        
        (,,,uint256 creatorLocked,,,,,,) = fpmm.pools(marketId);
        assertEq(creatorLocked, 10e6, "Creator should have 10 locked shares");

        // Fast forward 24h
        vm.warp(block.timestamp + 24 hours);

        // Creator CAN remove their normal shares
        vm.prank(creator);
        fpmm.removeLiquidity(marketId, creatorNormalShares);

        assertEq(fpmm.lpShares(marketId, creator), 0, "Creator normal shares should be 0");
        
        // Locked shares are still 10
        (,,,uint256 lockedAfter,,,,,,) = fpmm.pools(marketId);
        assertEq(lockedAfter, 10e6, "Creator locked shares should still be 10");
    }

    // ─── Add Liquidity Tests (Post-Activation) ───────────────────────────

    function test_addLiquidityMintsProportionalShares() public {
        _createActiveMarket(); // 200e6 pool

        uint256 sharesBefore = fpmm.lpShares(marketId, lp1);
        assertEq(sharesBefore, 0);

        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 100e6);

        uint256 sharesAfter = fpmm.lpShares(marketId, lp1);
        assertTrue(sharesAfter > 0, "LP should receive shares");
        assertEq(sharesAfter, 100e6, "Should get 1:1 shares in a balanced pool");
    }

    function test_addLiquidityRecordsTimestamp() public {
        _createActiveMarket();

        uint256 depositTime = block.timestamp + 1000;
        vm.warp(depositTime);
        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 50e6);

        assertEq(fpmm.lpDepositTime(marketId, lp1), depositTime, "Deposit time should be recorded");
    }

    // ─── Remove Liquidity Tests ──────────────────────────────────────────

    function test_removeLiquidityReturnsProportionalTokens() public {
        _createActiveMarket();

        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 100e6);

        // Wait for 24h lock to expire
        vm.warp(block.timestamp + 25 hours);

        uint256 shares = fpmm.lpShares(marketId, lp1);
        vm.prank(lp1);
        fpmm.removeLiquidity(marketId, shares);

        // LP should now hold YES + NO tokens
        uint256 yesId = vault.yesTokenId(marketId);
        uint256 noId = vault.noTokenId(marketId);
        assertTrue(vault.balanceOf(lp1, yesId) > 0, "LP should receive YES tokens");
        assertTrue(vault.balanceOf(lp1, noId) > 0, "LP should receive NO tokens");
        assertEq(fpmm.lpShares(marketId, lp1), 0, "LP shares should be zero");
    }

    function test_removeLiquidityRevertsWithin24Hours() public {
        _createActiveMarket();

        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 50e6);

        // Try to withdraw immediately
        uint256 shares = fpmm.lpShares(marketId, lp1);
        vm.prank(lp1);
        vm.expectRevert(VerityFPMM.LPLockActive.selector);
        fpmm.removeLiquidity(marketId, shares);

        // Try at 23 hours
        vm.warp(block.timestamp + 23 hours);
        vm.prank(lp1);
        vm.expectRevert(VerityFPMM.LPLockActive.selector);
        fpmm.removeLiquidity(marketId, shares);
    }

    function test_removeLiquidityWorksAfter24Hours() public {
        _createActiveMarket();

        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 50e6);

        // Wait exactly 24 hours
        vm.warp(block.timestamp + 24 hours);

        uint256 shares = fpmm.lpShares(marketId, lp1);
        vm.prank(lp1);
        fpmm.removeLiquidity(marketId, shares); // Should not revert
    }



    // ─── Buy Tests ───────────────────────────────────────────────────────

    function test_buyYesTokens() public {
        _createActiveMarket();

        uint256 usdcBefore = usdc.balanceOf(trader);
        vm.prank(trader);
        uint256 tokensOut = fpmm.buy(marketId, true, 10e6);

        assertTrue(tokensOut > 0, "Should receive YES tokens");
        assertEq(usdc.balanceOf(trader), usdcBefore - 10e6, "USDC should be deducted");

        uint256 yesId = vault.yesTokenId(marketId);
        assertEq(vault.balanceOf(trader, yesId), tokensOut, "Token balance should match");
    }

    function test_buyNoTokens() public {
        _createActiveMarket();

        vm.prank(trader);
        uint256 tokensOut = fpmm.buy(marketId, false, 10e6);

        assertTrue(tokensOut > 0, "Should receive NO tokens");

        uint256 noId = vault.noTokenId(marketId);
        assertEq(vault.balanceOf(trader, noId), tokensOut, "Token balance should match");
    }

    function test_buyDeducts2PercentFee() public {
        _createActiveMarket();

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        vm.prank(trader);
        fpmm.buy(marketId, true, 100e6);

        // Treasury should receive 40% of 2% fee = 0.8 USDC
        uint256 treasuryAfter = usdc.balanceOf(treasury);
        uint256 expectedTreasuryFee = (100e6 * 200 * 40) / (10_000 * 100); // 0.8e6
        assertEq(treasuryAfter - treasuryBefore, expectedTreasuryFee, "Treasury should receive 40% of fee");
    }

    function test_buyRevertsIfPoolNotActive() public {
        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 10e6); // Below 40 USDC threshold, pool not active

        vm.prank(trader);
        vm.expectRevert(VerityFPMM.PoolNotActive.selector);
        fpmm.buy(marketId, true, 10e6);
    }

    function test_buyShiftsPrice() public {
        _createActiveMarket();

        uint256 yesPriceBefore = fpmm.getYesPrice(marketId);
        assertEq(yesPriceBefore, 5e17, "Initial YES price should be 50%");

        // Buy YES — should increase YES price
        vm.prank(trader);
        fpmm.buy(marketId, true, 50e6);

        uint256 yesPriceAfter = fpmm.getYesPrice(marketId);
        assertTrue(yesPriceAfter > yesPriceBefore, "Buying YES should increase YES price");
    }

    function test_pricesSumToOne() public {
        _createActiveMarket();

        // Check at initial state
        uint256 yesPrice = fpmm.getYesPrice(marketId);
        uint256 noPrice = fpmm.getNoPrice(marketId);
        assertEq(yesPrice + noPrice, 1e18, "Prices should sum to 1e18");

        // After buying
        vm.prank(trader);
        fpmm.buy(marketId, true, 50e6);

        yesPrice = fpmm.getYesPrice(marketId);
        noPrice = fpmm.getNoPrice(marketId);
        assertEq(yesPrice + noPrice, 1e18, "Prices should still sum to 1e18 after trade");
    }

    // ─── Sell Tests ──────────────────────────────────────────────────────

    function test_sellReturnsUsdc() public {
        _createActiveMarket();

        // Buy YES first
        vm.prank(trader);
        uint256 tokensBought = fpmm.buy(marketId, true, 50e6);

        // Approve vault to transfer tokens (ERC1155 approval for FPMM)
        vm.prank(trader);
        vault.setApprovalForAll(address(fpmm), true);

        uint256 usdcBefore = usdc.balanceOf(trader);
        vm.prank(trader);
        uint256 usdcOut = fpmm.sell(marketId, true, tokensBought);

        assertTrue(usdcOut > 0, "Should receive USDC back");
        assertEq(usdc.balanceOf(trader) - usdcBefore, usdcOut, "USDC balance should increase");
    }

    function test_sellDeductsFee() public {
        _createActiveMarket();

        vm.prank(trader);
        uint256 tokensBought = fpmm.buy(marketId, true, 50e6);

        vm.prank(trader);
        vault.setApprovalForAll(address(fpmm), true);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        vm.prank(trader);
        fpmm.sell(marketId, true, tokensBought);

        uint256 treasuryAfter = usdc.balanceOf(treasury);
        assertTrue(treasuryAfter > treasuryBefore, "Treasury should receive fee from sell");
    }

    function test_sellRevertsIfPoolNotActive() public {
        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 10e6); // Below 40 USDC threshold, pool not active

        vm.prank(trader);
        vm.expectRevert(VerityFPMM.PoolNotActive.selector);
        fpmm.sell(marketId, true, 10e6);
    }

    // ─── Fee Split Verification ──────────────────────────────────────────

    function test_feeSplit60_40() public {
        _createActiveMarket();

        vm.prank(trader);
        fpmm.buy(marketId, true, 1000e6);

        // Total fee = 1000e6 * 200 / 10000 = 20e6
        // LP fee = 20e6 * 60 / 100 = 12e6
        // Treasury fee = 20e6 * 40 / 100 = 8e6
        uint256 treasuryBalance = usdc.balanceOf(treasury);
        assertEq(treasuryBalance, 8e6, "Treasury should receive 40% of fee");
    }

    // ─── Large Trade Slippage Test ───────────────────────────────────────

    function test_largeTradeSlippage() public {
        _createActiveMarket(); // 200 USDC pool

        // Try to buy 190 USDC worth in a 200 USDC pool — massive slippage
        vm.prank(trader);
        uint256 tokensOut = fpmm.buy(marketId, true, 190e6);

        // With a 200/200 pool, buying 190 USDC of YES:
        // actualAmount = 190 * 0.98 = 186.2 USDC
        // Should get a lot of tokens but at a terrible average price
        assertTrue(tokensOut > 0, "Should still receive some tokens");

        // YES price should be very high after this large buy
        uint256 yesPriceAfter = fpmm.getYesPrice(marketId);
        assertTrue(yesPriceAfter > 75e16, "YES price should be >75% after large buy");
    }

    // ─── Creator Claim After Resolution ──────────────────────────────────

    function test_claimCreatorLiquidityAfterResolution() public {
        _createActiveMarket();

        uint256 usdcBefore = usdc.balanceOf(creator);

        // Resolve
        factory.resolveMarket(marketId, true);

        // Creator claims
        vm.prank(creator);
        fpmm.claimCreatorLiquidity(marketId);

        assertEq(fpmm.lpShares(marketId, creator), 0, "Creator shares should be zero after claim");

        // Creator should now hold USDC directly, and no outcome tokens
        uint256 usdcAfter = usdc.balanceOf(creator);
        assertTrue(usdcAfter > usdcBefore, "Creator should receive USDC");

        uint256 yesId = vault.yesTokenId(marketId);
        uint256 noId = vault.noTokenId(marketId);
        assertEq(vault.balanceOf(creator, yesId), 0, "Creator should hold 0 YES tokens");
        assertEq(vault.balanceOf(creator, noId), 0, "Creator should hold 0 NO tokens");
    }

    function test_removeLiquidityAfterResolution() public {
        _createActiveMarket();

        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 100e6);

        // Resolve
        factory.resolveMarket(marketId, true);

        uint256 usdcBefore = usdc.balanceOf(lp1);

        uint256 shares = fpmm.lpShares(marketId, lp1);
        vm.prank(lp1);
        fpmm.removeLiquidity(marketId, shares);

        // LP should receive USDC directly and hold 0 outcome tokens
        uint256 usdcAfter = usdc.balanceOf(lp1);
        assertTrue(usdcAfter > usdcBefore, "LP should receive USDC");

        uint256 yesId = vault.yesTokenId(marketId);
        uint256 noId = vault.noTokenId(marketId);
        assertEq(vault.balanceOf(lp1, yesId), 0, "LP should hold 0 YES tokens");
        assertEq(vault.balanceOf(lp1, noId), 0, "LP should hold 0 NO tokens");
        assertEq(fpmm.lpShares(marketId, lp1), 0, "LP shares should be zero");
    }

    function test_claimCreatorLiquidityRevertsBeforeResolution() public {
        _createActiveMarket();

        vm.prank(creator);
        vm.expectRevert(VerityFPMM.PoolNotResolved.selector);
        fpmm.claimCreatorLiquidity(marketId);
    }

    function test_claimCreatorLiquidityRevertsIfNotCreator() public {
        _createActiveMarket();
        factory.resolveMarket(marketId, true);

        vm.prank(trader);
        vm.expectRevert(VerityFPMM.NotCreator.selector);
        fpmm.claimCreatorLiquidity(marketId);
    }

    // ─── Multiple Sequential Trades ──────────────────────────────────────

    function test_multipleSequentialTrades() public {
        _createActiveMarket();

        // Buy YES
        vm.prank(trader);
        fpmm.buy(marketId, true, 10e6);

        // Buy NO
        vm.prank(lp1);
        fpmm.buy(marketId, false, 15e6);

        // Buy YES again
        vm.prank(trader);
        fpmm.buy(marketId, true, 5e6);

        // Prices should still sum to 1
        uint256 yesPrice = fpmm.getYesPrice(marketId);
        uint256 noPrice = fpmm.getNoPrice(marketId);
        assertEq(yesPrice + noPrice, 1e18, "Prices should sum to 1e18 after multiple trades");
    }

    // ─── canRemoveLiquidity View ─────────────────────────────────────────

    function test_canRemoveLiquidityView() public {
        _createActiveMarket();

        vm.prank(lp1);
        fpmm.addLiquidity(marketId, 50e6);

        // Immediately: should be false (24h lock)
        assertFalse(fpmm.canRemoveLiquidity(marketId, lp1), "Should not be able to remove within 24h");

        // Creator: should be false (locked until resolution)
        assertFalse(fpmm.canRemoveLiquidity(marketId, creator), "Creator should not be able to remove");

        // After 24h: LP should be able to
        vm.warp(block.timestamp + 24 hours);
        assertTrue(fpmm.canRemoveLiquidity(marketId, lp1), "Should be able to remove after 24h");

        // Creator still locked
        assertFalse(fpmm.canRemoveLiquidity(marketId, creator), "Creator should still be locked");

        // After resolution: everyone can
        factory.resolveMarket(marketId, true);
        assertTrue(fpmm.canRemoveLiquidity(marketId, creator), "Creator should be able to remove after resolution");
    }

    function test_sellPreservesConstantProduct() public {
        _createActiveMarket();
        
        (uint256 yBefore, uint256 nBefore,,,,) = fpmm.getPoolBalances(marketId);
        uint256 initialProduct = yBefore * nBefore;

        // Buy YES
        vm.prank(trader);
        uint256 tokensBought = fpmm.buy(marketId, true, 20e6);

        // Approve vault
        vm.prank(trader);
        vault.setApprovalForAll(address(fpmm), true);

        // Sell YES
        vm.prank(trader);
        fpmm.sell(marketId, true, tokensBought);

        (uint256 yAfter, uint256 nAfter,,,,) = fpmm.getPoolBalances(marketId);
        uint256 finalProduct = yAfter * nAfter;

        assertApproxEqAbs(finalProduct, initialProduct, 10, "Product must be preserved after buy and sell");
    }
}
