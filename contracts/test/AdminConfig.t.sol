// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ConditionalTokenVault } from "../src/ConditionalTokenVault.sol";
import { VerityFPMM } from "../src/VerityFPMM.sol";
import { VerityMarketFactory } from "../src/VerityMarketFactory.sol";
import { MockUSDC } from "./helpers/MockUSDC.sol";

contract AdminConfigTest is Test {
    MockUSDC usdc;
    ConditionalTokenVault vault;
    VerityFPMM fpmm;
    VerityMarketFactory factory;

    address admin = address(this);
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address nonAdmin = makeAddr("nonAdmin");

    bytes32 marketId = keccak256("config-market");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new ConditionalTokenVault(address(usdc));
        fpmm = new VerityFPMM(address(vault), address(usdc), treasury);
        factory = new VerityMarketFactory(
            address(fpmm),
            address(vault),
            address(usdc),
            address(0) // No pyth needed for config tests
        );

        vault.setFpmm(address(fpmm));
        vault.setFactory(address(factory));
        fpmm.setFactory(address(factory));

        usdc.mint(creator, 10_000e6);
        usdc.mint(nonAdmin, 10_000e6);

        vm.prank(creator);
        usdc.approve(address(factory), type(uint256).max);

        vm.prank(nonAdmin);
        usdc.approve(address(factory), type(uint256).max);
    }

    // ─── Default Config Checks ──────────────────────────────────────────

    function test_default_configurations() public view {
        assertEq(fpmm.feeBps(), 200, "Default feeBps should be 200");
        assertEq(fpmm.lpFeeShare(), 60, "Default lpFeeShare should be 60");
        assertEq(fpmm.treasuryFeeShare(), 40, "Default treasuryFeeShare should be 40");
        assertEq(fpmm.minPoolBalance(), 40e6, "Default minPoolBalance should be 40 USDC");
        assertEq(fpmm.creatorMinLock(), 10e6, "Default creatorMinLock should be 10 USDC");
        assertEq(fpmm.lpLockDuration(), 24 hours, "Default lpLockDuration should be 24 hours");
        assertEq(factory.marketCreationFee(), 1e6, "Default marketCreationFee should be 1 USDC");
    }

    // ─── feeBps Setter Tests ───────────────────────────────────────────

    function test_setFeeBps_success() public {
        fpmm.setFeeBps(500); // 5% maximum allowed
        assertEq(fpmm.feeBps(), 500);

        fpmm.setFeeBps(0); // 0% fee allowed
        assertEq(fpmm.feeBps(), 0);
    }

    function test_setFeeBps_revertsIfNotAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert(VerityFPMM.Unauthorized.selector);
        fpmm.setFeeBps(300);
    }

    function test_setFeeBps_revertsIfExceedsCap() public {
        vm.expectRevert(VerityFPMM.InvalidValue.selector);
        fpmm.setFeeBps(501); // 5.01% should fail
    }

    // ─── Fee Shares Setter Tests ────────────────────────────────────────

    function test_setFeeShares_success() public {
        fpmm.setFeeShares(50, 50);
        assertEq(fpmm.lpFeeShare(), 50);
        assertEq(fpmm.treasuryFeeShare(), 50);

        fpmm.setFeeShares(100, 0);
        assertEq(fpmm.lpFeeShare(), 100);
        assertEq(fpmm.treasuryFeeShare(), 0);
    }

    function test_setFeeShares_revertsIfNotAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert(VerityFPMM.Unauthorized.selector);
        fpmm.setFeeShares(50, 50);
    }

    function test_setFeeShares_revertsIfSumNot100() public {
        vm.expectRevert(VerityFPMM.InvalidValue.selector);
        fpmm.setFeeShares(60, 39); // Sum is 99, should fail

        vm.expectRevert(VerityFPMM.InvalidValue.selector);
        fpmm.setFeeShares(60, 41); // Sum is 101, should fail
    }

    // ─── Pool Limits Setter Tests ───────────────────────────────────────

    function test_setPoolLimits_success() public {
        fpmm.setPoolLimits(100e6, 20e6);
        assertEq(fpmm.minPoolBalance(), 100e6);
        assertEq(fpmm.creatorMinLock(), 20e6);
    }

    function test_setPoolLimits_revertsIfNotAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert(VerityFPMM.Unauthorized.selector);
        fpmm.setPoolLimits(100e6, 20e6);
    }

    // ─── LP Lock Duration Setter Tests ──────────────────────────────────

    function test_setLpLockDuration_success() public {
        fpmm.setLpLockDuration(3 days);
        assertEq(fpmm.lpLockDuration(), 3 days);

        fpmm.setLpLockDuration(0);
        assertEq(fpmm.lpLockDuration(), 0);
    }

    function test_setLpLockDuration_revertsIfNotAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert(VerityFPMM.Unauthorized.selector);
        fpmm.setLpLockDuration(1 days);
    }

    function test_setLpLockDuration_revertsIfExceedsCap() public {
        vm.expectRevert(VerityFPMM.InvalidValue.selector);
        fpmm.setLpLockDuration(3 days + 1 seconds); // Exceeds 3 days cap
    }

    // ─── Market Creation Fee Setter Tests ───────────────────────────────

    function test_setMarketCreationFee_success() public {
        factory.setMarketCreationFee(2e6);
        assertEq(factory.marketCreationFee(), 2e6);

        factory.setMarketCreationFee(0);
        assertEq(factory.marketCreationFee(), 0);
    }

    function test_setMarketCreationFee_revertsIfNotAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert(VerityMarketFactory.Unauthorized.selector);
        factory.setMarketCreationFee(2e6);
    }

    // ─── Helper checking dynamic creation fee behavior ──────────────────

    function test_marketCreationFee_enforcesUpdatedFee() public {
        // Change fee to 5 USDC
        factory.setMarketCreationFee(5e6);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 creatorBefore = usdc.balanceOf(creator);

        // Creator deposits 10 USDC (minimum lock) and pays 5 USDC fee
        vm.prank(creator);
        factory.createMarketPreDeposit(marketId, 10e6);

        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 5e6, "Treasury should receive 5 USDC fee");
        assertEq(creatorBefore - usdc.balanceOf(creator), 15e6, "Creator should spend 15 USDC in total");
    }

    function test_marketCreationFee_zeroFee() public {
        // Change fee to 0 USDC
        factory.setMarketCreationFee(0);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 creatorBefore = usdc.balanceOf(creator);

        // Creator deposits 10 USDC (minimum lock) and pays 0 USDC fee
        vm.prank(creator);
        factory.createMarketPreDeposit(marketId, 10e6);

        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 0, "Treasury should receive 0 USDC fee");
        assertEq(creatorBefore - usdc.balanceOf(creator), 10e6, "Creator should spend exactly 10 USDC");
    }
}
