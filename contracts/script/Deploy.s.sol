// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import "../src/ConditionalTokenVault.sol";
import "../src/VerityFPMM.sol";
import "../src/VerityMarketFactory.sol";
import "../test/helpers/MockUSDC.sol";

contract BroadcasterFinder {
    address public immutable broadcaster;

    constructor() {
        broadcaster = msg.sender;
    }
}

contract Deploy is Script {
    struct NetworkConfig {
        string networkName;
        address usdcAddress;
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
                isTestnet: true
            });
        }
        // Local Testnet (Anvil)
        else {
            config = NetworkConfig({
                networkName: "Local Testnet",
                usdcAddress: address(0), // Will deploy MockUSDC
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
        address deployer = finder.broadcaster();
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

        // 1. Deploy ConditionalTokenVault
        console2.log("\nDeploying ConditionalTokenVault...");
        ConditionalTokenVault vault = new ConditionalTokenVault(usdcAddr);
        console2.log("ConditionalTokenVault deployed at:", address(vault));

        // 2. Deploy VerityFPMM
        console2.log("Deploying VerityFPMM...");
        VerityFPMM fpmm = new VerityFPMM(address(vault), usdcAddr, treasury);
        console2.log("VerityFPMM deployed at:", address(fpmm));

        // 3. Deploy VerityMarketFactory
        console2.log("Deploying VerityMarketFactory...");
        VerityMarketFactory factory = new VerityMarketFactory(
            address(fpmm),
            address(vault),
            usdcAddr
        );
        console2.log("VerityMarketFactory deployed at:", address(factory));

        // 4. Wire up permissions
        console2.log("\nWiring up contract permissions...");
        vault.setFPMM(address(fpmm));
        vault.setFactory(address(factory));
        fpmm.setFactory(address(factory));
        console2.log("Contract permissions wired successfully.");

        vm.stopBroadcast();

        logDeployment(
            address(vault),
            address(fpmm),
            address(factory),
            usdcAddr,
            deployer,
            treasury,
            config
        );
    }

    function logDeployment(
        address vault,
        address fpmm,
        address factory,
        address usdcAddr,
        address deployer,
        address treasury,
        NetworkConfig memory config
    ) internal view {
        console2.log("\n=== Deployment Summary ===");
        console2.log("Network:", config.networkName);
        console2.log("\n--- Contract Addresses ---");
        console2.log("USDC:", usdcAddr);
        console2.log("ConditionalTokenVault:", vault);
        console2.log("VerityFPMM (AMM):", fpmm);
        console2.log("VerityMarketFactory (Registry):", factory);
        console2.log("\n--- Configuration ---");
        console2.log("Admin (Factory/FPMM/Vault Owner):", deployer);
        console2.log("Treasury:", treasury);
        console2.log("\n=== Deployment Complete ===");
    }
}
