// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ConditionalTokenVault.sol";
import "../src/VerityFPMM.sol";
import "../src/VerityMarketFactory.sol";
import "../src/VerityRouter.sol";
import "../src/VerityOptimisticResolver.sol";
import "./helpers/MockUSDC.sol";
import "./helpers/MockPyth.sol";

/// @title VerityRouterTest
contract VerityRouterTest is Test {
    MockUSDC usdc;
    MockPyth pyth;
    ConditionalTokenVault vault;
    VerityFPMM fpmm;
    VerityMarketFactory factory;
    VerityOptimisticResolver resolver;
    VerityRouter router;

    address admin = address(this);
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address lp1 = makeAddr("lp1");
    address trader = makeAddr("trader");
    address arbitrator = makeAddr("arbitrator");

    bytes32 marketId = keccak256("market-1");

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();
        vault = new ConditionalTokenVault(address(usdc));
        fpmm = new VerityFPMM(address(vault), address(usdc), treasury);
        factory = new VerityMarketFactory(address(fpmm), address(vault), address(usdc), address(pyth));
        resolver = new VerityOptimisticResolver(address(usdc), address(factory), arbitrator);
        router = new VerityRouter(address(usdc), address(vault));

        vault.setFPMM(address(fpmm));
        vault.setFactory(address(factory));
        fpmm.setFactory(address(factory));
        factory.setOptimisticResolver(address(resolver));

        // Fund accounts
        usdc.mint(creator, 10_000e6);
        usdc.mint(lp1, 10_000e6);
        usdc.mint(trader, 10_000e6);

        // Crucial: Users ONLY approve the Router!
        vm.prank(creator);
        usdc.approve(address(router), type(uint256).max);

        vm.prank(lp1);
        usdc.approve(address(router), type(uint256).max);

        vm.prank(trader);
        usdc.approve(address(router), type(uint256).max);
    }

    function test_createMarketPreDepositThroughRouter() public {
        vm.prank(creator);
        router.createMarketPreDeposit(address(factory), marketId, 10e6);

        (address registeredCreator, , , , , , ) = factory.marketRegistry(marketId);
        assertEq(registeredCreator, creator, "Creator should be creator EOA");

        assertEq(factory.escrowBalances(marketId), 10e6, "Escrow balance should be 10 USDC");
        
        (address lp, uint256 amount) = factory.getPreMarketDeposit(marketId, 0);
        assertEq(lp, creator, "LP beneficiary should be creator EOA");
        assertEq(amount, 10e6);
    }

    function test_depositPreMarketLiquidityThroughRouter() public {
        vm.prank(creator);
        router.createMarketPreDeposit(address(factory), marketId, 10e6);

        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);

        vm.prank(lp1);
        router.depositPreMarketLiquidity(address(factory), marketId, 30e6);

        (,,,, bool active,) = fpmm.getPoolBalances(marketId);
        assertTrue(active, "Pool should automatically deploy after reaching 40 USDC");

        assertEq(fpmm.lpShares(marketId, lp1), 30e6, "LP1 should receive 30 shares in pool");
    }

    function test_buyThroughRouter() public {
        vm.prank(creator);
        router.createMarketPreDeposit(address(factory), marketId, 40e6);

        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);

        uint256 traderUsdcBefore = usdc.balanceOf(trader);

        vm.prank(trader);
        uint256 tokensOut = router.buy(address(fpmm), marketId, true, 10e6);

        assertTrue(tokensOut > 0, "Trader should receive YES tokens");
        assertEq(usdc.balanceOf(trader), traderUsdcBefore - 10e6, "USDC should be deducted from trader");

        uint256 yesId = vault.yesTokenId(marketId);
        assertEq(vault.balanceOf(trader, yesId), tokensOut, "Trader EOA should hold the YES tokens");
        assertEq(vault.balanceOf(address(router), yesId), 0, "Router should hold 0 dust YES tokens");
    }

    function test_addLiquidityThroughRouter() public {
        vm.prank(creator);
        router.createMarketPreDeposit(address(factory), marketId, 40e6);

        factory.registerMarket(marketId, creator, block.timestamp + 30 days, block.timestamp + 7 days);

        vm.prank(lp1);
        router.addLiquidity(address(fpmm), marketId, 100e6);

        assertEq(fpmm.lpShares(marketId, lp1), 100e6, "LP1 should receive 100 shares in the pool");
        assertEq(fpmm.lpShares(marketId, address(router)), 0, "Router should hold 0 LP shares");
    }

    function test_proposeResolutionThroughRouter() public {
        // Setup market
        vm.prank(creator);
        router.createMarketPreDeposit(address(factory), marketId, 40e6);
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 2 days);

        // Warp past deadline
        vm.warp(block.timestamp + 1 days + 1);

        uint256 traderBalBefore = usdc.balanceOf(trader);

        // Propose YES via router
        vm.prank(trader);
        router.proposeResolution(address(resolver), marketId, true);

        // Verify bond deducted from trader
        assertEq(usdc.balanceOf(trader), traderBalBefore - resolver.resolutionBond(), "Bond not debited from trader");
        assertEq(usdc.balanceOf(address(resolver)), resolver.resolutionBond(), "Resolver did not receive bond");

        // Verify proposer registered is the trader EOA
        (address p, bool winYes, , bool disp, , bool fin) = resolver.proposals(marketId);
        assertEq(p, trader, "Proposer should be trader EOA");
        assertTrue(winYes);
        assertFalse(disp);
        assertFalse(fin);
    }

    function test_disputeResolutionThroughRouter() public {
        // Setup market and proposal
        vm.prank(creator);
        router.createMarketPreDeposit(address(factory), marketId, 40e6);
        factory.registerMarket(marketId, creator, block.timestamp + 1 days, block.timestamp + 2 days);
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(trader);
        router.proposeResolution(address(resolver), marketId, true);

        uint256 lp1BalBefore = usdc.balanceOf(lp1);

        // Dispute via router
        vm.prank(lp1);
        router.disputeResolution(address(resolver), marketId);

        // Verify bond deducted from disputer (lp1)
        assertEq(usdc.balanceOf(lp1), lp1BalBefore - resolver.resolutionBond(), "Bond not debited from disputer");

        // Verify disputer registered is lp1 EOA
        (, , , bool disp, address d, bool fin) = resolver.proposals(marketId);
        assertTrue(disp);
        assertEq(d, lp1, "Disputer should be lp1 EOA");
        assertFalse(fin);
    }
}
