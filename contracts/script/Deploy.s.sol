// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ConditionalTokenVault} from "../src/ConditionalTokenVault.sol";
import {VerityFPMM} from "../src/VerityFPMM.sol";
import {VerityMarketFactory} from "../src/VerityMarketFactory.sol";
import {VerityOptimisticResolver} from "../src/VerityOptimisticResolver.sol";
import {MockUSDC} from "../test/helpers/MockUSDC.sol";
import {MockPyth} from "../test/helpers/MockPyth.sol";

contract BroadcasterFinder {
    address public immutable BROADCASTER;

    constructor() {
        BROADCASTER = msg.sender;
    }
}

contract Deploy is Script {
    struct NetworkConfig {
        string networkName;
        address usdcAddress;
        address pythAddress;
        address vaultAddress;
        bool isTestnet;
    }

    function setUp() public {}

    function getDeploymentConfig()
        internal
        view
        returns (NetworkConfig memory config)
    {
        // Arc Testnet
        if (block.chainid == 5042002) {
            config = NetworkConfig({
                networkName: "Arc Testnet",
                usdcAddress: 0x3600000000000000000000000000000000000000,
                pythAddress: 0x2880aB155794e7179c9eE2e38200202908C17B43,
                vaultAddress: 0xd418a4116E48A180DCA0b6b5a2D69b17Cb1F1Ac3, // Set this to the existing vault address to reuse it (e.g. 0xd418a4116E48A180DCA0b6b5a2D69b17Cb1F1Ac3)
                isTestnet: true
            });
        }
        // Local Testnet (Anvil)
        else {
            config = NetworkConfig({
                networkName: "Local Testnet",
                usdcAddress: address(0), // Will deploy MockUSDC
                pythAddress: address(0), // Will deploy MockPyth
                vaultAddress: address(0),
                isTestnet: true
            });
        }
    }

    function run() external {
        NetworkConfig memory config = getDeploymentConfig();

        console2.log("=== Verity Prediction Market Deployment ===");
        console2.log("Network:", config.networkName);
        console2.log("Chain ID:", block.chainid);

        // Start broadcasting to find the CLI account address
        vm.startBroadcast();
        BroadcasterFinder finder = new BroadcasterFinder();
        address deployer = finder.BROADCASTER();
        vm.stopBroadcast();

        // Restart broadcast with the correct resolved deployer address
        vm.startBroadcast(deployer);

        // Default treasury to the deployer if not specified in environment
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        console2.log("Deployer / Admin:", deployer);
        console2.log("Treasury:", treasury);

        address usdcAddr = config.usdcAddress;
        if (usdcAddr == address(0)) {
            console2.log("\nNo USDC address configured. Deploying MockUSDC...");
            MockUSDC mockUsdc = new MockUSDC();
            usdcAddr = address(mockUsdc);
            console2.log("MockUSDC deployed at:", usdcAddr);
        } else {
            console2.log("Using configured USDC at:", usdcAddr);
        }

        address pythAddr = config.pythAddress;
        if (pythAddr == address(0)) {
            console2.log("\nNo Pyth address configured. Deploying MockPyth...");
            MockPyth mockPyth = new MockPyth();
            pythAddr = address(mockPyth);
            console2.log("MockPyth deployed at:", pythAddr);
        } else {
            console2.log("Using configured Pyth at:", pythAddr);
        }

        // 1. Deploy ConditionalTokenVault (or reuse existing)
        address vaultAddr = config.vaultAddress;
        ConditionalTokenVault vault;
        if (vaultAddr != address(0)) {
            console2.log(
                "\nReusing existing ConditionalTokenVault at:",
                vaultAddr
            );
            vault = ConditionalTokenVault(vaultAddr);
        } else {
            console2.log("\nDeploying new ConditionalTokenVault...");
            vault = new ConditionalTokenVault(usdcAddr);
            vaultAddr = address(vault);
            console2.log("ConditionalTokenVault deployed at:", vaultAddr);
        }

        // 2. Deploy VerityFPMM
        console2.log("Deploying VerityFPMM...");
        VerityFPMM fpmm = new VerityFPMM(vaultAddr, usdcAddr, treasury);
        console2.log("VerityFPMM deployed at:", address(fpmm));

        // 3. Deploy VerityMarketFactory
        console2.log("Deploying VerityMarketFactory...");
        VerityMarketFactory factory = new VerityMarketFactory(
            address(fpmm),
            vaultAddr,
            usdcAddr,
            pythAddr
        );
        console2.log("VerityMarketFactory deployed at:", address(factory));

        // 4. Deploy VerityOptimisticResolver
        console2.log("Deploying VerityOptimisticResolver...");
        VerityOptimisticResolver resolver = new VerityOptimisticResolver(
            usdcAddr,
            address(factory),
            deployer // deployer is the initial arbitrator
        );
        console2.log(
            "VerityOptimisticResolver deployed at:",
            address(resolver)
        );

        // 5. Wire up permissions
        console2.log("\nWiring up contract permissions...");
        if (vault.admin() == deployer) {
            console2.log(
                "Updating FPMM and Factory on ConditionalTokenVault..."
            );
            vault.setFpmm(address(fpmm));
            vault.setFactory(address(factory));
        } else {
            console2.log(
                "WARNING: Deployer is not the admin of the existing vault. Skipped vault.setFpmm() and vault.setFactory()."
            );
        }
        fpmm.setFactory(address(factory));
        factory.setOptimisticResolver(address(resolver));
        console2.log("Contract permissions wired successfully.");

        vm.stopBroadcast();

        logDeployment(
            address(vault),
            address(fpmm),
            address(factory),
            address(resolver),
            usdcAddr,
            pythAddr,
            deployer,
            treasury,
            config
        );
    }

    function logDeployment(
        address vault,
        address fpmm,
        address factory,
        address resolver,
        address usdcAddr,
        address pythAddr,
        address deployer,
        address treasury,
        NetworkConfig memory config
    ) internal pure {
        console2.log("\n=== Deployment Summary ===");
        console2.log("Network:", config.networkName);
        console2.log("\n--- Contract Addresses ---");
        console2.log("USDC:", usdcAddr);
        console2.log("Pyth:", pythAddr);
        console2.log("ConditionalTokenVault:", vault);
        console2.log("VerityFPMM (AMM):", fpmm);
        console2.log("VerityMarketFactory (Registry):", factory);
        console2.log("VerityOptimisticResolver:", resolver);
        console2.log("\n--- Configuration ---");
        console2.log("Admin (Factory/FPMM/Vault Owner):", deployer);
        console2.log("Treasury:", treasury);
        console2.log("\n=== Deployment Complete ===");
    }
}
