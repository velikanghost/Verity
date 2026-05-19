# Verity Prediction Market Smart Contracts

This directory contains the smart contracts for the Verity prediction market platform, built using the **Foundry** development framework.

## Contract Architecture

The core of Verity's prediction market is composed of three primary smart contracts:

1. **`ConditionalTokenVault.sol`**:
   - Manages escrowed collateral (USDC).
   - Mints conditional YES/NO outcome tokens for a market in exchange for USDC collateral.
   - Handles the payout distribution/collateral redemptions once a market is resolved.

2. **`VerityMarketFactory.sol`**:
   - Acts as the central registry for all prediction markets on-chain.
   - Enforces market creation fee collection.
   - Holds pre-market liquidity escrow deposits.
   - Automatically deploys and initializes the corresponding `VerityFPMM` market pool once the 40 USDC funding threshold is crossed.

3. **`VerityFPMM.sol`**:
   - The Fixed Product Market Maker (AMM) contract.
   - Allows users to buy/sell YES and NO outcome tokens using USDC.
   - Manages LP positions, share minting/burning, and 24-hour LP lock-up rules.

---

## Development Guide

### Project Setup
First, ensure you have Foundry installed. If not, follow the [Foundry Book Installation Guide](https://book.getfoundry.sh/getting-started/installation).

Initialize dependencies:
```bash
forge install
```

### Build & Compile
Compile the smart contracts and generate the ABI artifacts:
```bash
forge build
```
The compiled JSON artifacts will be placed in the `out/` directory.

### Run Tests
Execute the Solidity unit test suite:
```bash
forge test
```

For verbose output/stack traces:
```bash
forge test -vvvv
```

### Deploying to Arc Testnet
A deployment script is provided at `script/Deploy.s.sol`. To execute a live deployment to Arc Testnet:

1. Setup environment variables or pass options inline:
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key <your_private_key> \
  --broadcast
```

2. Note the deployed contract addresses printed to the terminal. You will need to add these to your backend `.env` configuration file.
