# Verity

Verity is a social prediction app built with Next.js, Supabase, RainbowKit, wagmi, and viem. It supports normal social posts plus opinion market posts where users can cast free YES/NO opinions or back a side with Arc testnet USDC.

## Current MVP

- Wallet identity with RainbowKit and Arc testnet support
- Supabase-backed profiles, posts, market posts, comments, likes, reshares, and free votes
- Normal posts with like, comment, reshare, and share actions
- Opinion market posts with free upvote/downvote sentiment
- Arc testnet USDC balance reads from the connected wallet
- Market creation fee and trading fee defaults
- USDC-backed buy/sell ledger for YES and NO positions
- Market detail pages with rules, USDC sentiment, trade ticket, position summary, and payout preview

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase
- RainbowKit, wagmi, viem
- Arc testnet USDC ERC20 reads and transfers

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required public variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_VERITY_TREASURY_ADDRESS=
```

Do not commit `.env.local`, private keys, or Supabase service role keys.

## Supabase Setup

Run the SQL migrations in order from the Supabase SQL editor:

```text
supabase/migrations/0001_phase2_schema.sql
supabase/migrations/0002_add_market_fee_defaults.sql
supabase/migrations/0003_add_usdc_vote_audit_fields.sql
supabase/migrations/0004_add_market_positions_trades.sql
```

The app uses the publishable anon key from Supabase. Current RLS policies are permissive for the wallet-auth MVP and should be tightened before production.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`. If that port is busy, run:

```bash
npm run dev -- --port 3001
```

## Checks

```bash
npm run lint
npm run build
```

Both should pass before pushing changes.

## Product Rules

Normal posts:

- Like, comment, reshare, share
- No market
- No USDC backing

Opinion market posts:

- Question, category, deadline, resolution source, YES condition, NO condition, status
- Free upvote means YES
- Free downvote means NO
- YES/NO buttons in the trade ticket are for USDC-backed positions
- Market sentiment reflects USDC-backed opinions only

## Known Limitations

- USDC-backed buys transfer Arc testnet USDC to the treasury address, but there is not yet an escrow smart contract.
- Sell orders currently update the in-app ledger only. They do not transfer USDC back on-chain.
- Payout preview is an estimate based on in-app shares and assumes a correct outcome pays `$1` per share.
- Pricing is currently based on simple implied market share, not a production AMM or order book.
- Market resolution, oracle/AI settlement, payouts, fee splitting, and dispute flows are not implemented yet.
- RLS policies are MVP-friendly and need wallet signature auth or Supabase Auth hardening before mainnet.

## Next Phase

Recommended next build phase:

- Add a real market escrow contract
- Move USDC backing and selling into on-chain contract calls
- Implement claimable payouts after resolution
- Add market resolution workflow and audit trail
- Add historical sentiment snapshots and charting
- Tighten Supabase write policies around authenticated wallet ownership
