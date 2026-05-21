# Verity NestJS Backend

Verity's decentralized backend service, built using the NestJS framework and MongoDB (Mongoose). It is responsible for database persistence, user registration, post indexing, free voting rules, and validating/syncing state with smart contracts deployed on the Arc Testnet. It also includes the automated AI resolution keeper loop.

## Core Features

- **Auth & Users**: Wallet-based login (`POST /api/users/wallet/:address`) and JWT protection.
- **Posts & Comments**: Native posts feed supporting standard content and prediction market declarations.
- **On-Chain Escrow & Funding Verification**: Verifies USDC transfer receipts and triggers database state changes (e.g. `qualified` $\to$ `funding_pool` $\to$ `tradable`).
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
CONDITIONAL_TOKEN_VAULT_ADDRESS=0x5D97c2a4fD99838095dFc1a17d6aEDfc64410cE4
FPMM_ADDRESS=0x5e1b479c67ed99b8bd45E01eAbBD5ddE73011A7F
FACTORY_ADDRESS=0x04dd36473333FC42F4e87d92Ef7ec915D652827b
RESOLVER_ADDRESS=0x3Ec306418602139b2028a7CB4cA1884e87D37B03

# Required for E2E testing (requires gas + mock USDC)
TEST_PRIVATE_KEY=0x...

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
Executes the E2E test suites, signing transactions on Arc Testnet via your `TEST_PRIVATE_KEY`:

*   **Standard E2E**:
    ```bash
    pnpm run test:backend-e2e
    ```
*   **Pyth Live Resolution E2E**:
    ```bash
    pnpm run test:pyth-live
    ```
*   **AI Agent + Optimistic Resolver Live E2E**:
    ```bash
    pnpm run test:resolver-live
    ```
