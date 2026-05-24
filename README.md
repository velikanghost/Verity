# Verity

Verity is a social prediction network where people share **Takes**, turn strong claims into **Markets**, gather free **Upvote/Downvote** signals, and trade YES/NO outcomes with Arc testnet USDC.

The app is a pnpm monorepo with a Next.js frontend, a NestJS backend, and Foundry smart contracts.

## Live URLs

- Frontend: https://veritymarket.vercel.app
- Backend: https://verity-c9wp.onrender.com
- Circle faucet: https://faucet.circle.com/

## Product Language

- **Take**: a regular social post.
- **Market**: a prediction post with a clear question, deadline, source, and YES/NO outcome rules.
- **Upvote / Downvote**: free daily social signals used before a Market becomes tradable.
- **Pool Funding**: launch-pool USDC that helps a qualified Market complete bonding and open trading.
- **Liquidity**: USDC in an active Market pool. Market creators and liquidity providers may earn fees or rewards if a Market completes bonding and attracts trading activity.

## Stack

- **Frontend**: Next.js App Router, React 19, Tailwind CSS v4, shadcn base components, RainbowKit, Wagmi, Viem
- **Backend**: NestJS 11, MongoDB/Mongoose, Swagger, JWT, keeper services
- **Contracts**: Foundry, Arc Testnet, USDC, Pyth-enabled market resolution, optimistic resolver, router contract
- **Package manager**: pnpm workspaces

## Repository Structure

```text
Verity/
  frontend/                 Next.js app
    src/app/                App Router pages and metadata images
    src/components/         UI, feed, wallet, profile, market components
    src/hooks/              React and wallet hooks
    src/lib/                Shared frontend helpers and contract config
    src/store/              API client and React Query hooks

  backend/                  NestJS API
    src/modules/auth/       Auth and wallet user serialization
    src/modules/users/      Wallet profiles and daily vote reads
    src/modules/posts/      Takes, Markets, likes, reshares
    src/modules/comments/   Comments
    src/modules/markets/    Market lifecycle, votes, trades, positions
    src/modules/liquidity/  Pool funding and LP state
    src/modules/blockchain/ Contract reads/writes and ABI sync
    src/modules/agent/      Resolution agent support

  contracts/                Foundry contracts and tests
  package.json              Root workspace scripts
  pnpm-workspace.yaml       Workspace packages
  pnpm-lock.yaml            Locked dependencies
```

## Smart Contracts

The frontend-facing contract is the **Router**. Users approve USDC to the router once, then Verity routes funding, liquidity, trading, and dispute actions through it where supported.

Current frontend defaults are in `frontend/src/lib/arc.ts`:

```text
Router:   0xfd5b97972669Dbd447560B4c7b0eEbe7BD58ff3d
Factory:  0x47248BfD909337F78De56Aaa82d070Eb8964F30F
FPMM:     0x51203EF25B201A9138603d50711092698C350e24
Resolver: 0x8D387a1704E7efb92b315e97db54DA92a6212A1b
Vault:    0x53B2404b703B78e0dfca79ffA0BDf7eBCb17E563
USDC:     0x3600000000000000000000000000000000000000
```

## Getting Started

### Prerequisites

- Node.js 20.9 or newer
- pnpm
- MongoDB for local backend development
- WalletConnect project ID for wallet login
- Arc testnet wallet with testnet USDC

### Install

```bash
pnpm install:all
```

### Frontend Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5050/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000

NEXT_PUBLIC_ROUTER_ADDRESS=0xfd5b97972669Dbd447560B4c7b0eEbe7BD58ff3d
NEXT_PUBLIC_FACTORY_ADDRESS=0x47248BfD909337F78De56Aaa82d070Eb8964F30F
NEXT_PUBLIC_FPMM_ADDRESS=0x51203EF25B201A9138603d50711092698C350e24
NEXT_PUBLIC_RESOLVER_ADDRESS=0x8D387a1704E7efb92b315e97db54DA92a6212A1b
NEXT_PUBLIC_VAULT_ADDRESS=0x53B2404b703B78e0dfca79ffA0BDf7eBCb17E563
```

### Backend Environment

Create `backend/.env` from `backend/.env.example` and set:

```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/verity
JWT_SECRET=replace_with_a_secure_secret

ARC_RPC_URL=https://rpc.testnet.arc.network
USDC_ADDRESS=0x3600000000000000000000000000000000000000
ROUTER_ADDRESS=0xfd5b97972669Dbd447560B4c7b0eEbe7BD58ff3d
FACTORY_ADDRESS=0x47248BfD909337F78De56Aaa82d070Eb8964F30F
FPMM_ADDRESS=0x51203EF25B201A9138603d50711092698C350e24
RESOLVER_ADDRESS=0x8D387a1704E7efb92b315e97db54DA92a6212A1b
CONDITIONAL_TOKEN_VAULT_ADDRESS=0x53B2404b703B78e0dfca79ffA0BDf7eBCb17E563
```

## Development

Run the frontend and backend in separate terminals:

```bash
pnpm dev:frontend
pnpm dev:backend
```

Default local URLs:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5050/api
- Swagger docs: http://localhost:5050/api/docs

Seed local backend data:

```bash
pnpm --filter verity-backend seed
```

## Build Checks

Run these before pushing:

```bash
pnpm build:frontend
pnpm build:backend
```

## Current Frontend Notes

- Wallet onboarding uses a one-time router approval flow.
- Users must choose a username after wallet activation.
- Desktop sidebar `Post` opens a chooser for **Market** or **Take**.
- Mobile has a floating `+` button with the same **Market** / **Take** chooser.
- Metadata, favicon, Apple icon, Open Graph image, and Twitter preview image are generated from the frontend app.

## Deployment Notes

- Frontend deploys to Vercel.
- Backend deploys to Render.
- Keep frontend public contract env values aligned with backend and deployed contracts.
- Database resets may remove local/social test data while backend social features are still being wired.
