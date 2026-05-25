# Verity NestJS Backend

Verity's decentralized backend service, built using the NestJS framework and MongoDB (Mongoose). It is responsible for database persistence, user registration, post indexing, free voting rules, and validating/syncing state with smart contracts deployed on the Arc Testnet. It also includes the automated AI resolution keeper loop.

## Core Features

- **Auth & Users**: Wallet-based login (`POST /api/users/wallet/:address`) and JWT protection.
- **Posts & Comments**: Native posts feed supporting standard content and prediction market declarations.
- **On-Chain Pool Funding Verification**: Verifies USDC transaction receipts and triggers database state changes (e.g. `qualified` -> `funding_pool` -> `tradable`).
- **AMM Pricing & LP Tracking**: Integrates with `VerityFPMM` contract to fetch YES/NO token pricing and user LP positions.
- **AI Agent Resolution Engine**: Uses Tavily Search API and configurable LLMs (Gemini, Claude, OpenAI) to gather facts and automatically propose outcomes for subjective prediction markets.
- **Resolution Keeper**: An automated resolution agent checking expired markets every 30 seconds to submit Pyth VAAs or LLM-driven proposals.
- **Swagger API Docs**: Premium interactive documentation served at `/api/docs`.
- **On-Chain E2E Tests**: Suite that executes actual, signed transactions on Arc Testnet to verify the system from end to end.

---

## Getting Started

### 1. Project Configuration

Install dependencies from the monorepo root:

```bash
pnpm install
```

Configure the environment variables by copying `.env.example` to `.env` inside the `backend/` folder:

```bash
cp .env.example .env
```

Ensure the following variables are configured correctly:

```env
MONGODB_URI=mongodb://localhost:27017/verity
JWT_SECRET=your-long-secure-secret-key
JWT_EXPIRES_IN=7d

# Arc Testnet Configuration
ARC_RPC_URL=https://rpc.testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000
ROUTER_ADDRESS=0xfd5b97972669Dbd447560B4c7b0eEbe7BD58ff3d
CONDITIONAL_TOKEN_VAULT_ADDRESS=0x53B2404b703B78e0dfca79ffA0BDf7eBCb17E563
FPMM_ADDRESS=0x51203EF25B201A9138603d50711092698C350e24
FACTORY_ADDRESS=0x47248BfD909337F78De56Aaa82d070Eb8964F30F
RESOLVER_ADDRESS=0x8D387a1704E7efb92b315e97db54DA92a6212A1b

# Required for E2E testing (requires gas + mock USDC)
ADMIN_PRIVATE_KEY=0x...

# AI Agent Config
LLM_PROVIDER=claude        # options: gemini, openai, claude, mock
TAVILY_API_KEY=tvly-...
CLAUDE_API_KEY=sk-ant-...  # required if LLM_PROVIDER is claude
CLAUDE_MODEL=claude-3-haiku-20240307 # optional custom model Override
GEMINI_API_KEY=AIzaSy...   # required if LLM_PROVIDER is gemini
OPENAI_API_KEY=sk-proj-... # required if LLM_PROVIDER is openai
```

---

## Available Scripts

### Extract ABIs

Extracts ABI definitions from compiled Foundry artifacts and copies them into the backend package for use in blockchain read/write calls:

```bash
pnpm run extract-abis
```

### Run Local Development Server

Starts the NestJS application in watch mode:

```bash
pnpm run dev
```

The server runs on http://localhost:5050/api, and you can view the Swagger UI documentation at http://localhost:5050/api/docs.

### Seed Database

Seeds the MongoDB database with initial sample mock data:

```bash
pnpm run seed
```

### Run Unit & Integration Tests

Runs the Jest test suites (including agent resolution, keeper simulations, etc.):

```bash
pnpm run test
```

### Run On-Chain E2E Tests

Executes the E2E test suites, signing transactions on Arc Testnet via your `ADMIN_PRIVATE_KEY`:

- **Standard E2E**:
  ```bash
  pnpm run test:backend-e2e
  ```
- **Pyth Live Resolution E2E**:
  ```bash
  pnpm run test:pyth-live
  ```
- **AI Agent + Optimistic Resolver Live E2E**:
  ```bash
  pnpm run test:resolver-live
  ```
