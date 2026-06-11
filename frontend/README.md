# Verity Frontend

The client-side interface for the Verity prediction market platform, built with **Next.js (App Router)**, **React 19**, and styled with **Tailwind CSS v4**. It features a responsive social feed, on-chain trading modules, Smart Contract Account onboarding, and real-time activity tracking.

---

## Page Routes

| Route            | View Description                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`              | **Home Feed**: A unified stream of normal posts and prediction market cards with daily voting options.                   |
| `/markets/[id]`  | **Market Detail**: Complete trading interface with swap panels, liquidity provider tabs, and resolution/dispute options. |
| `/explore`       | **Market Discovery**: Browse prediction markets by category or volume metrics.                                           |
| `/profile/[id]`  | **Public Profile**: User statistics, past posts, active positions, and Arena XP.                                         |
| `/wallet`        | **Wallet Dashboard**: View USDC balances, portfolio position values, and transaction histories.                          |
| `/notifications` | **Activity Center**: Lists comment threads, matchup results, and resolution events.                                      |
| `/how-it-works`  | **Glossary & Guide**: Detailed instructions on qualification, trading mechanics, and fee setups.                         |
| `/posts/[id]`    | **Thread View**: Displays a single post with its comment trees.                                                          |

---

## Component Taxonomy

```
src/components/
├── feed/        # ComposeBox, FeedTabs, FeedShell - main feed stream coordination
├── post/        # PostCard, MarketCard - individual items rendering
├── markets/     # SwapTicket, LPPanel, ResolutionCard - details page trading tools
├── social/      # CommentModal, CommentThread - interaction dialogs
├── profile/     # ProfileBio, PortfolioPositions - user dashboard blocks
├── layout/      # Sidebar, RightPanel, ThemeToggle - workspace shell
├── providers/   # AppProviders, QueryClient, ThemeProvider - bootstrap wrappers
└── ui/          # Button, Input, Modal, Table, Skeleton - generic atomic elements
```

---

## Custom React Hooks

The client uses specialized custom hooks to interface with NestJS REST/WebSocket endpoints and Arc Testnet smart contracts:

| Hook                  | Category      | Description                                                                  |
| --------------------- | ------------- | ---------------------------------------------------------------------------- |
| `useMarketLiquidity`  | Web3/On-Chain | Handles pre-market launch funding approvals and LP deposits to `VerityFPMM`. |
| `useMarketResolution` | Web3/On-Chain | Triggers resolution disputes and bond approvals.                             |
| `useUsdcTransfer`     | Web3/On-Chain | Sends USDC directly on-chain using Smart Accounts.                           |
| `useUsdcBalance`      | Web3/On-Chain | Queries the smart account's USDC balance.                                    |
| `useDailyVotes`       | API/State     | Tracks remaining free daily signal votes (capped at 10/day).                 |
| `useFeed`             | API/State     | Fetches feed posts from NestJS with market-only filtering.                   |
| `useSocket`           | WebSocket     | Manages Socket.IO listener rooms for instant updates.                        |
| `useUserPortfolio`    | API/State     | Retrieves positions, trade logs, and balances.                               |

---

## Design System & Styling

Verity v1 is built with a premium look matching modern design aesthetics:

- **Tailwind CSS v4**: Utilizes the latest compiler with custom theme definitions.
- **HSL Color Variables**: Dynamic color palettes defining `.verity-card`, `.verity-pill`, and `.verity-blob` classes supporting light and dark theme toggling.
- **Geist Font Family**: Renders modern typography using `next/font/google` (Geist Sans & Geist Mono).
- **Subtle Animations**: Micro-animations using transitions for interactive hover feedback and transaction wait states.

---

## Getting Started

### Installation

```bash
# From monorepo root
pnpm install

# Setup Env
cd frontend
cp .env.example .env
```

### Environment Parameters

Ensure the following variables are configured in `.env`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5050/api
NEXT_PUBLIC_WS_URL=http://localhost:5050

# Arc Testnet Configuration
NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000

# Contract Addresses
NEXT_PUBLIC_FACTORY_ADDRESS=
NEXT_PUBLIC_FPMM_ADDRESS=
NEXT_PUBLIC_RESOLVER_ADDRESS=
NEXT_PUBLIC_VAULT_ADDRESS=
```

### Development Server

```bash
pnpm run dev      # Launches dev client on http://localhost:3000
pnpm run build    # Compiles and bundles Next.js for production
```
