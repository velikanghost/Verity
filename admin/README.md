# Verity Admin Console

The administrative control panel and moderation dashboard for Verity. Built with **Next.js (App Router)**, **React 19**, and styled with **Tailwind CSS v4** + shadcn UI primitives.

This app runs independently of the main frontend, providing administrators with tools to manage markets, pre-fund liquidity pools, deploy PvP matchup tournaments, and execute manual resolution overrides.

---

## Authentication Modes

Access to the Admin Console is restricted to accounts flagged with the `"admin"` role in MongoDB. The console supports two sign-in workflows:

1.  **Email OTP Credentials**:
    - Enter the administrator email.
    - A 6-digit verification code is generated. (Logged to the NestJS API terminal console in development).
    - Enter the OTP to receive a signed admin JWT.

---

## Dashboard Console Interface

The dashboard is divided into three key panels:

### A. Admin Wallet Status

- Tracks the connected administrative wallet on the **Arc Testnet**.
- Displays real-time balances: **USDC** (collateral) and **ARC** (gas).
- **PvP Event Cost Estimator**: Calculates the total pre-deposit cost (40 USDC per option) for the currently selected PvP setup.

### B. Deploy World Cup PvP Matchup

Deploy Parent PvP events and auto-fund their child options on-chain:

- **Configure Parent Event**: Provide the match title (e.g. Paraguay vs Japan), lock-in deadline, and resolution source.
- **Toggle Proposition Builders**: Enable preset football prediction categories:
  - **Match Winner**: 3-way outcome (Home wins / Draw / Away wins).
  - **First Team to Score**: 3-way outcome (Home / No Goal / Away).
  - **Red Card**: Binary outcome (At least one red card / No red cards).
  - **Corners**: Over/Under handicap selection (6.5 to 10.5 corners).
  - **Goals**: Over/Under handicap selection (0.5 to 4.5 goals).
  - **Yellow Cards**: Over/Under handicap selection (2.5 to 6.5 cards).
  - **Custom Propositions**: Input arbitrary yes/no criteria dynamically.
- **Deploy**: Submits the setup to `POST /api/pvp/events`. The backend pre-deposits 40 USDC for each child option from the admin account and registers the markets on-chain.

### C. Prediction Market Moderation

A table showing all registered prediction markets, their status indicators (`open_for_votes`, `qualified`, `funding_pool`, `tradable`, `resolving`), and context actions:

- **Approve Trading**: Transitions qualified markets (50+ signals) to `funding_pool` status and registers them on-chain.
- **Add Liquidity**: Escrow USDC deposits into pre-market pools to help them reach the 40 USDC threshold required for FPMM activation.
- **Arbitrate Resolve**: Manually settle subjective or disputed markets. The administrator chooses the winning outcome (YES/NO or multi-option index), enters the confirming on-chain transaction hash, and verifies the fee collector address to finalize redemptions.

---

## Getting Started

### Installation

```bash
# From monorepo root
pnpm install

# Setup Env
cd admin
cp .env.example .env   # Verify NEXT_PUBLIC_API_URL points to the NestJS API (http://localhost:5050/api)
```

### Run Locally

```bash
pnpm run dev      # Launches dev client on http://localhost:3001
pnpm run build    # Bundles the console app for deployment
```
