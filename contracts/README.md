# Verity Smart Contracts

Solidity smart contracts powering Verity's prediction market infrastructure on the **Arc Testnet**. These contracts handle the full market lifecycle: USDC escrow, ERC-1155 outcome token minting, AMM pool trading, liquidity provision, and dispute-window optimistic resolution.

---

## Architecture Overview

The system uses a shared contract model. All prediction markets and AMM pools use a single, global deployment of the following four contracts:

```
                  ┌──────────────────────┐
                  │ VerityMarketFactory  │◄─────── callback
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │   VerityFPMM    │               │OptimisticResolver│
   └────────┬────────┘               └─────────────────┘
            │
            ▼
┌──────────────────────┐
│ConditionalTokenVault │ (ERC-1155)
└──────────────────────┘
```

1.  **`ConditionalTokenVault.sol`**: A global ERC-1155 token registry. Accepts USDC collateral and mints paired YES/NO outcome tokens for active markets. Post-resolution, winning outcome token holders redeem their shares 1:1 for the vault's USDC.
2.  **`VerityFPMM.sol`**: Fixed Product Market Maker (AMM). Manages reserves for all outcome pools. Supports swapping USDC for outcome tokens (`buy()`), selling outcome tokens back to reserves (`sell()`), and adding/removing liquidity.
3.  **`VerityMarketFactory.sol`**: The entrypoint registry. Handles market registration, pre-market funding, auto-deployment of pools when the threshold is met, and resolution trigger callbacks.
4.  **`VerityOptimisticResolver.sol`**: An optimistic resolution protocol. Resolves subjective markets using staked bonds. Proposers and disputers stake bonds (10 USDC). Undisputed outcomes are finalized; disputed outcomes are arbitrated by the protocol arbitrator.

---

## Protocol Constants & Parameters

The deployed contracts are configured with the following parameters:

- **Minimum Pool Balance (`MIN_POOL_BALANCE`)**: `40 USDC` (6 decimals). A market's pre-market escrow must reach this amount before it graduates to tradable status and deploys the AMM pool.
- **Creator Minimum Lock (`CREATOR_MIN_LOCK`)**: `10 USDC` (6 decimals). The market creator must pre-deposit at least this amount to register a market. Creator shares are locked and cannot be withdrawn until the market resolves.
- **LP Lock Duration (`LP_LOCK_DURATION`)**: `24 Hours`. Public liquidity providers are locked from removing their deposits for 24 hours starting from their last deposit block timestamp.
- **Trading Fee (`FEE_BPS`)**: `200 BPS` (2.0% of trade volume).
- **Fee Split**:
  - **60%** is distributed to the pool's Liquidity Providers (`LP_FEE_SHARE`).
  - **40%** is sent to the Verity Protocol Treasury (`TREASURY_FEE_SHARE`).
- **Resolution Proposal Bond (`resolutionBond`)**: `10 USDC`. Required stake to propose an outcome.
- **Dispute Window (`disputeWindow`)**: `2 Minutes` (in Testnet environment) / `4 Hours` (in Production environment). Time allowed for users to dispute a proposed outcome.

---

## Developer Guide

### Prerequisites

- Install [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Solidity compiler `0.8.24`

### Installation

Clone dependencies (OpenZeppelin Contracts, Pyth SDK, Forge Std):

```bash
forge install
```

### Build Contracts

Compile Solidity source files:

```bash
forge build
```

### Test Suite

Run the full test suite covering token vaults, AMM formulas, resolver states, and edge cases:

```bash
forge test
```

For verbose logging and stack traces:

```bash
forge test -vvvv
```

### Deploy to Arc Testnet

Deploy contracts using the Foundry script:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast
```

After deployment, update the addresses in the backend/frontend `.env` configurations:

- `USDC_ADDRESS`
- `FACTORY_ADDRESS`
- `FPMM_ADDRESS`
- `RESOLVER_ADDRESS`
- `CONDITIONAL_TOKEN_VAULT_ADDRESS`
