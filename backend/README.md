# Verity NestJS Backend

Verity's decentralized backend service, built using the NestJS framework and MongoDB (Mongoose). It is responsible for database persistence, user registration, post indexing, free voting rules, and validating/syncing state with smart contracts deployed on the Arc Testnet.

## Core Features

- **Auth & Users**: Wallet-based login (`POST /api/users/wallet/:address`) and JWT protection.
- **Posts & Comments**: Native posts feed supporting standard content and prediction market declarations.
- **On-Chain Escrow & Funding Verification**: Verifies USDC transfer receipts and triggers database state changes (e.g. `qualified` $\to$ `funding_pool` $\to$ `tradable`).
- **AMM Pricing & LP Tracking**: Integrates with `VerityFPMM` contract to fetch YES/NO token pricing and user LP positions.
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
CONDITIONAL_TOKEN_VAULT_ADDRESS=0x79De0fD38A5c34C5336Ba4C42bD51011d4167d6e
FPMM_ADDRESS=0xB9842bf8c49b4Db54262141DcD289126E1A43a82
FACTORY_ADDRESS=0x230ec66d9898E81050Fb721c67E3093938Eb8a16

# Required only for running the E2E test suite (requires gas + mock USDC)
TEST_PRIVATE_KEY=0x...
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

### Run On-Chain E2E Tests
Executes the E2E test suite, spinning up a local server instance and signing actual transactions on Arc Testnet via your `TEST_PRIVATE_KEY`:
```bash
pnpm run test:backend-e2e
```
