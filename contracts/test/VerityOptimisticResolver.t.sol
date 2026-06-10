// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ConditionalTokenVault } from "../src/ConditionalTokenVault.sol";
import { VerityFPMM } from "../src/VerityFPMM.sol";
import { VerityMarketFactory } from "../src/VerityMarketFactory.sol";
import { VerityOptimisticResolver } from "../src/VerityOptimisticResolver.sol";
import { MockUSDC } from "./helpers/MockUSDC.sol";
import { MockPyth } from "./helpers/MockPyth.sol";

contract VerityOptimisticResolverTest is Test {
    MockUSDC usdc;
    MockPyth pyth;
    ConditionalTokenVault vault;
    VerityFPMM fpmm;
    VerityMarketFactory factory;
    VerityOptimisticResolver resolver;

    address admin = address(this);
    address arbitrator = makeAddr("arbitrator");
    address proposer = makeAddr("proposer");
    address disputer = makeAddr("disputer");
    address creator = makeAddr("creator");

    bytes32 marketId = keccak256("subjective-market");

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();
        vault = new ConditionalTokenVault(address(usdc));
        fpmm = new VerityFPMM(
            address(vault),
            address(usdc),
            makeAddr("treasury")
        );
        factory = new VerityMarketFactory(
            address(fpmm),
            address(vault),
            address(usdc),
            address(pyth)
        );

        resolver = new VerityOptimisticResolver(
            address(usdc),
            address(factory),
            arbitrator
        );

        // Wire up permissions
        vault.setFpmm(address(fpmm));
        vault.setFactory(address(factory));
        fpmm.setFactory(address(factory));

        // Configure resolver on factory
        factory.setOptimisticResolver(address(resolver));

        // Mint USDC to proposer and disputer
        usdc.mint(proposer, 1000e6);
        usdc.mint(disputer, 1000e6);
        usdc.mint(creator, 1000e6);

        // Approvals
        vm.prank(proposer);
        usdc.approve(address(resolver), type(uint256).max);

        vm.prank(disputer);
        usdc.approve(address(resolver), type(uint256).max);

        vm.prank(creator);
        usdc.approve(address(factory), type(uint256).max);
    }

    function _createAndFundMarket() internal {
        // Register market with deadline 1 day from now
        factory.registerMarket(
            marketId,
            creator,
            block.timestamp + 1 days,
            block.timestamp + 2 days
        );

        // Deposit minimum pre-market liquidity
        vm.prank(creator);
        factory.depositPreMarketLiquidity(marketId, 40e6);
    }

    function test_proposeResolution_success() public {
        _createAndFundMarket();

        // Warp past deadline
        vm.warp(block.timestamp + 1 days + 1);

        uint256 initialBal = usdc.balanceOf(proposer);

        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0);

        // Check bond is locked in resolver contract
        assertEq(
            usdc.balanceOf(proposer),
            initialBal - resolver.resolutionBond(),
            "Proposer bond not debited"
        );
        assertEq(
            usdc.balanceOf(address(resolver)),
            resolver.resolutionBond(),
            "Resolver did not receive bond"
        );

        // Verify proposal state
        (
            address p,
            uint256 winYes,
            uint256 pTime,
            bool disp,
            address d,
            bool fin
        ) = resolver.proposals(marketId);
        assertEq(p, proposer);
        assertEq(winYes, 0);
        assertEq(pTime, block.timestamp);
        assertFalse(disp);
        assertEq(d, address(0));
        assertFalse(fin);
    }

    function test_proposeResolution_revertsBeforeDeadline() public {
        _createAndFundMarket();

        // Do not warp past deadline
        vm.expectRevert(VerityOptimisticResolver.MarketNotExpired.selector);
        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0);
    }

    function test_disputeResolution_success() public {
        _createAndFundMarket();
        vm.warp(block.timestamp + 1 days + 1);

        // Propose
        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0);

        // Dispute
        uint256 initialBal = usdc.balanceOf(disputer);
        vm.prank(disputer);
        resolver.disputeResolution(marketId);

        // Check bond is locked in resolver
        assertEq(
            usdc.balanceOf(disputer),
            initialBal - resolver.resolutionBond(),
            "Disputer bond not debited"
        );
        assertEq(
            usdc.balanceOf(address(resolver)),
            2 * resolver.resolutionBond(),
            "Resolver did not receive dispute bond"
        );

        // Verify proposal state
        (, , , bool disp, address d, bool fin) = resolver.proposals(marketId);
        assertTrue(disp, "Proposal should be marked disputed");
        assertEq(d, disputer, "Disputer address mismatch");
        assertFalse(fin, "Proposal should not be finalized");
    }

    function test_disputeResolution_revertsAfterWindow() public {
        _createAndFundMarket();
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0);

        // Warp past dispute window (2 hours)
        vm.warp(block.timestamp + resolver.disputeWindow() + 1);

        vm.expectRevert(VerityOptimisticResolver.DisputeWindowExpired.selector);
        vm.prank(disputer);
        resolver.disputeResolution(marketId);
    }

    function test_finalizeResolution_success() public {
        _createAndFundMarket();
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0);

        // Warp past dispute window
        vm.warp(block.timestamp + resolver.disputeWindow() + 1);

        uint256 initialBal = usdc.balanceOf(proposer);

        // Anyone can finalize
        resolver.finalizeResolution(marketId);

        // Verify bond refund
        assertEq(
            usdc.balanceOf(proposer),
            initialBal + resolver.resolutionBond(),
            "Proposer bond not refunded"
        );
        assertEq(
            usdc.balanceOf(address(resolver)),
            0,
            "Resolver contract should hold 0 funds"
        );

        // Verify factory market resolved
        (, , , , , bool resolved, , ) = factory.marketRegistry(marketId);
        assertTrue(resolved, "Market should be marked resolved on factory");

        // Verify proposal state
        (, , , , , bool fin) = resolver.proposals(marketId);
        assertTrue(fin, "Proposal should be marked finalized");
    }

    function test_finalizeResolution_revertsIfDisputeWindowActive() public {
        _createAndFundMarket();
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0);

        // Dispute window is 2 minutes, warp only 1 minute
        vm.warp(block.timestamp + 1 minutes);

        vm.expectRevert(VerityOptimisticResolver.DisputeWindowActive.selector);
        resolver.finalizeResolution(marketId);
    }

    function test_resolveDisputedMarket_proposerWins() public {
        _createAndFundMarket();
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0); // Proposes YES

        vm.prank(disputer);
        resolver.disputeResolution(marketId);

        uint256 proposerInitialBal = usdc.balanceOf(proposer);
        uint256 disputerInitialBal = usdc.balanceOf(disputer);

        // Arbitrator rules in favor of proposer (YES wins)
        vm.prank(arbitrator);
        resolver.resolveDisputedMarket(marketId, 0);

        // Proposer gets both bonds (refunded original bond + disputer's bond)
        assertEq(
            usdc.balanceOf(proposer),
            proposerInitialBal + 2 * resolver.resolutionBond(),
            "Proposer did not receive payout"
        );
        assertEq(
            usdc.balanceOf(disputer),
            disputerInitialBal,
            "Disputer should not receive refund"
        );
        assertEq(
            usdc.balanceOf(address(resolver)),
            0,
            "Resolver should hold 0 funds"
        );

        // Verify market resolved on factory
        (, , , , , bool resolved, , ) = factory.marketRegistry(marketId);
        assertTrue(resolved, "Market should be resolved on factory");
    }

    function test_resolveDisputedMarket_disputerWins() public {
        _createAndFundMarket();
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(proposer);
        resolver.proposeResolution(marketId, 0); // Proposes YES

        vm.prank(disputer);
        resolver.disputeResolution(marketId);

        uint256 proposerInitialBal = usdc.balanceOf(proposer);
        uint256 disputerInitialBal = usdc.balanceOf(disputer);

        // Arbitrator rules in favor of disputer (NO wins)
        vm.prank(arbitrator);
        resolver.resolveDisputedMarket(marketId, 1);

        // Disputer gets both bonds
        assertEq(
            usdc.balanceOf(disputer),
            disputerInitialBal + 2 * resolver.resolutionBond(),
            "Disputer did not receive payout"
        );
        assertEq(
            usdc.balanceOf(proposer),
            proposerInitialBal,
            "Proposer should not receive refund"
        );
        assertEq(
            usdc.balanceOf(address(resolver)),
            0,
            "Resolver should hold 0 funds"
        );

        // Verify market resolved on factory
        (, , , , , bool resolved, , ) = factory.marketRegistry(marketId);
        assertTrue(resolved, "Market should be resolved on factory");
    }
}
