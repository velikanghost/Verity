# Verity Backend

The NestJS 11 API server powering Verity's social sports prediction arena. Handles user authentication, PvP matchmaking duels, on-chain market verification, liquidity pool management, and automated market resolution.

## Module Overview

The backend is organized into 16 domain modules under `src/modules/`:

| Module            | Purpose                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **auth**          | Coordinates passwordless Email OTP verification via Resend and secure local JWT generation.              |
| **users**         | Wallet profiles, usernames, signal point tracking, follower counts, active boosts                        |
| **posts**         | Social event post containers                                                                             |
| **markets**       | Market creation, free voting, USDC trading (buy/sell), position tracking                                 |
| **liquidity**     | LP pool initialization, deposits, withdrawals, 24h lock enforcement, on-chain state sync                 |
| **blockchain**    | Viem-based on-chain reads/writes, Account Abstraction calldata decoder, transaction receipt verification |
| **agent**         | AI resolution agent — web search via DuckDuckGo, outcome analysis via Claude/Gemini/OpenAI/DeepSeek      |
| **notifications** | Activity feed: matchup results, boost awards, market resolution events                                    |
| **socket**        | Socket.IO WebSocket gateway for real-time feed/market/user broadcasts                                    |
| **comments**      | Threaded comment system on posts                                                                         |
| **circle-wallet** | Circle WaaS smart wallet provisioning and Circle Batching/Nanopayments payouts service                   |
| **pvp**           | Player-vs-Player Matchups Arena: coordinates duels, queues tickets, matches opponents, and scores duels  |
| **coupons**       | Handles promotional duel boost coupons                                                                   |
| **missions**      | Database onboarding milestones rewarding Arena XP                                                        |
| **categories**    | System-wide tag groupings for prediction feeds                                                           |

### Cross-Cutting (`src/common/`)

- **`JwtAuthGuard`**: Restricts endpoints to authenticated JWT holders. Database-first lookup resolves active user smart wallets instantly.
- **`HttpExceptionFilter`**: Standardized error response formatting.
- **`ResponseInterceptor`**: Wraps all successful responses in a consistent envelope.

## Market Resolution Keeper

The `MarketsKeeperService` runs a background loop every **30 seconds** that:

1. **Promotes qualified markets** — checks escrow balances on-chain and auto-transitions markets to `tradable` when they reach the 20 USDC threshold.
2. **Resolves Pyth markets** — fetches historical price VAAs from the Pyth Benchmarks API and submits resolution transactions.
3. **Resolves subjective markets** — invokes the AI agent to search the web, analyze evidence, and propose YES/NO outcomes. Monitors the dispute window and auto-finalizes undisputed proposals.

## On-Chain Integration

The `BlockchainService` uses **Viem** to interact with four smart contracts on Arc Testnet:

- Reads: escrow balances, pool states, LP shares, market prices, proposal statuses, dispute windows
- Writes: market registration, resolution proposals, finalization (via admin wallet)
- **AA/Safe decoder**: `getCallSequence()` recursively unwraps nested calldata from EntryPoint `handleOps`, Smart Account `execute`/`executeBatch`, and Safe `execTransaction` to correctly verify transactions from smart wallets

## Nanopayments & Fee Distribution (Circle Batching)

Verity implements a hybrid database/on-chain micro-fee routing system utilizing the **Circle Gateway Client (`@circle-fin/x402-batching/client`)** to payout accumulated fees to Liquidity Providers and Creator/Treasury addresses.

### Flow Architecture

1. **Fee Accumulation**:
   - Every trade executed via the Fixed Product Market Maker (`VerityFPMM`) incurs a 2.0% fee.
   - The fee is split: **60% to LPs** and **40% to Creator/Treasury**.
   - These are calculated off-chain and logged in the database (`LpFeeLedger` for LP fees, and individual `MarketTrade` documents for Creator royalties).

2. **LP Fee Payouts (`LpFeeService`)**:
   - A background queue (`processPendingLpFees()`) regularly scans for trades with pending fees.
   - It updates users' accrued balances in the `LpFeeLedger` collection.
   - If an LP's accrued fees meet the auto-push threshold (`LP_FEE_AUTOPUSH_THRESHOLD_USDC`, e.g. `1.0 USDC`), the service calls the `NanopaymentsService` to execute a payout.
   - LPs can also trigger a manual claim via the `/liquidity/claim-fees` endpoint.

3. **Creator Royalties (`RoyaltyService`)**:
   - The royalty queue monitors finalized trades and groups creator royalties by recipient address.
   - It issues batched payouts to creator wallets using the `NanopaymentsService`.

4. **Circle Gateway Batching (`NanopaymentsService`)**:
   - Interacts with Circle's X402 Batching client.
   - Checks the Gateway balance. If the balance is insufficient to cover the payout, it automatically triggers a developer-controlled top-up deposit from the main treasury wallet (configured via `ADMIN_PRIVATE_KEY` / `KEEPER_PRIVATE_KEY`) to the batching gateway.
   - Executes off-chain batched withdrawals to target user wallets, completing the gas-efficient distribution of USDC micro-payouts.

## Getting Started

### Install & Configure

```bash
# From monorepo root
pnpm install

# Configure environment
cd backend
cp .env.example .env
```

Required environment variables:

```env
MONGODB_URI=mongodb://localhost:27017/verity
PORT=5050
JWT_SECRET=<secure-secret>

# Arc Testnet contract addresses
ARC_RPC_URL=https://rpc.testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000
PYTH_ADDRESS=
CONDITIONAL_TOKEN_VAULT_ADDRESS=
FPMM_ADDRESS=
FACTORY_ADDRESS=
RESOLVER_ADDRESS=

# PvP Welcome Boost Configuration
NEW_USER_CUTOFF_DATE=

# Circle WaaS & Resend Configuration
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_WALLET_SET_ID=
CIRCLE_BLOCKCHAIN=ARC-TESTNET
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# AI Agent (optional — defaults to mock)
LLM_PROVIDER=claude   # Options: claude | gemini | openai | deepseek | mock
CLAUDE_API_KEY=
CLAUDE_MODEL=
GEMINI_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=

# Gas Escrow & Signer (Admin / Keeper / E2E testing)
ADMIN_PRIVATE_KEY=
KEEPER_PRIVATE_KEY=
DISPUTE_WINDOW_SECONDS=
```

### Available Scripts

```bash
pnpm run dev              # Start in watch mode (http://localhost:5050/api)
pnpm run build            # Production build
pnpm run seed             # Populate DB with mock data
pnpm run extract-abis     # Copy contract ABIs from Foundry artifacts
pnpm run test             # Unit tests
```

### API Documentation

Swagger UI is served at `http://localhost:5050/api/docs` when the dev server is running.
