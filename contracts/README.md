# Verity Smart Contracts

Foundry-based Solidity smart contracts powering Verity's on-chain prediction market infrastructure on the **Arc Testnet**. These contracts manage the full market lifecycle: USDC escrow, conditional outcome token minting, AMM trading, liquidity provisioning, and optimistic dispute-based resolution.

## Contracts

### `ConditionalTokenVault.sol`

ERC-1155 conditional token system. Accepts USDC collateral and mints paired YES/NO outcome tokens for a given market ID. After resolution, winning token holders redeem their shares 1:1 for the escrowed USDC.

### `VerityMarketFactory.sol`

Central market registry. Handles:

- Market creation with a 1 USDC fee
- Pre-market liquidity escrow deposits (via `createMarketPreDeposit` and `depositPreMarketLiquidity`)
- Automatic FPMM pool deployment when the escrow reaches the 40 USDC threshold
- Resolution callbacks from authorized resolver contracts
- Refund claims for voided markets

### `VerityFPMM.sol`

Fixed Product Market Maker. Provides constant-product AMM pricing for YES/NO outcome tokens. Supports:

- `buy` / `sell` — trade outcome tokens against USDC
- `addLiquidity` / `addLiquidityFor` — LP deposits that mint proportional LP shares
- `removeLiquidity` — LP withdrawals with a 24-hour lock from last deposit
- `claimCreatorLiquidity` — creator-specific LP claim after market resolution
- Trading fee collection (configurable BPS, default 2%)

### `VerityOptimisticResolver.sol`

Dispute-window resolution system for subjective markets:

- `proposeResolution` / `proposeResolutionFor` — stake a 10 USDC bond to propose YES or NO
- `disputeResolution` / `disputeResolutionFor` — stake a 10 USDC bond to flag a proposal as disputed, forwarding to the arbitrator
- `finalizeResolution` — settles undisputed proposals after the dispute window (configurable: 120s for testing, 2 hours in production)
- Bond payouts: winner gets both bonds back; disputed outcomes are settled by the arbitrator


## Dependencies

- [OpenZeppelin Contracts](https://github.com/openzeppelin/openzeppelin-contracts) — `IERC20`, `SafeERC20`, `ERC1155Holder`
- [Forge Std](https://github.com/foundry-rs/forge-std) — testing utilities
- [Pyth SDK Solidity](https://www.npmjs.com/package/@pythnetwork/pyth-sdk-solidity) — price feed integration for objective markets

## Test Suite

Four test files covering the core contracts:

| Test                             | What it covers                                                         |
| -------------------------------- | ---------------------------------------------------------------------- |
| `ConditionalTokenVault.t.sol`    | Token minting, redemption, collateral escrow                           |
| `VerityFPMM.t.sol`               | AMM pricing, buy/sell, LP add/remove, fee collection, lock enforcement |
| `VerityOptimisticResolver.t.sol` | Proposal, dispute, finalization, bond payouts                          |

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Solidity 0.8.24 (configured in `foundry.toml`)

### Build

```bash
forge install   # Initialize git submodule dependencies
forge build     # Compile contracts → out/
```

### Test

```bash
forge test          # Run all tests
forge test -vvvv    # Verbose with stack traces and gas
```

### Deploy to Arc Testnet

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.network \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast
```

After deployment, update the contract addresses in `backend/.env` and `frontend/.env`:

- `CONDITIONAL_TOKEN_VAULT_ADDRESS`
- `FPMM_ADDRESS`
- `FACTORY_ADDRESS`
- `RESOLVER_ADDRESS`
