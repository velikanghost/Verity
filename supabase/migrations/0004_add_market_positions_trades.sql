create table if not exists public.market_positions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.market_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('YES', 'NO')),
  shares numeric not null default 0,
  avg_price numeric not null default 0,
  invested_usdc numeric not null default 0,
  realized_pnl numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(market_id, user_id, side)
);

create table if not exists public.market_trades (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.market_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('YES', 'NO')),
  action text not null check (action in ('BUY', 'SELL')),
  shares numeric not null default 0,
  price numeric not null default 0,
  amount_usdc numeric not null default 0,
  fee_usdc numeric not null default 0,
  gross_usdc numeric not null default 0,
  tx_hash text,
  created_at timestamp with time zone not null default now()
);

create index if not exists market_positions_market_id_idx on public.market_positions(market_id);
create index if not exists market_positions_user_id_idx on public.market_positions(user_id);
create index if not exists market_trades_market_id_idx on public.market_trades(market_id);
create index if not exists market_trades_created_at_idx on public.market_trades(created_at desc);

alter table public.market_positions enable row level security;
alter table public.market_trades enable row level security;

create policy "market positions are publicly readable" on public.market_positions for select using (true);
create policy "market positions can be created by wallet clients" on public.market_positions for insert with check (true);
create policy "market positions can be updated by wallet clients" on public.market_positions for update using (true) with check (true);

create policy "market trades are publicly readable" on public.market_trades for select using (true);
create policy "market trades can be created by wallet clients" on public.market_trades for insert with check (true);

insert into public.market_positions (
  market_id,
  user_id,
  side,
  shares,
  avg_price,
  invested_usdc,
  created_at,
  updated_at
)
select
  votes.market_id,
  votes.user_id,
  votes.side,
  greatest(votes.amount, 0) / 0.5,
  0.5,
  greatest(votes.amount, 0),
  votes.created_at,
  votes.created_at
from public.votes
where votes.vote_type = 'usdc'
  and votes.amount > 0
on conflict (market_id, user_id, side) do nothing;

insert into public.market_trades (
  market_id,
  user_id,
  side,
  action,
  shares,
  price,
  amount_usdc,
  fee_usdc,
  gross_usdc,
  tx_hash,
  created_at
)
select
  votes.market_id,
  votes.user_id,
  votes.side,
  'BUY',
  greatest(votes.amount, 0) / 0.5,
  0.5,
  greatest(votes.amount, 0),
  votes.fee_amount,
  votes.gross_amount,
  votes.tx_hash,
  votes.created_at
from public.votes
where votes.vote_type = 'usdc'
  and votes.amount > 0
  and not exists (
    select 1
    from public.market_trades existing
    where existing.market_id = votes.market_id
      and existing.user_id = votes.user_id
      and existing.tx_hash is not distinct from votes.tx_hash
  );
