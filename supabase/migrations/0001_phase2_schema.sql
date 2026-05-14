create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('normal', 'market')),
  content text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.market_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts(id) on delete cascade,
  question text not null,
  category text not null,
  deadline timestamp with time zone not null,
  resolution_source text not null,
  yes_condition text not null,
  no_condition text not null,
  status text not null default 'open',
  free_yes_votes integer not null default 0,
  free_no_votes integer not null default 0,
  usdc_yes_amount numeric not null default 0,
  usdc_no_amount numeric not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.market_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('YES', 'NO')),
  vote_type text not null check (vote_type in ('free', 'usdc')),
  amount numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  unique(market_id, user_id, vote_type)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.reshares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.reputation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  social_correct integer not null default 0,
  social_total integer not null default 0,
  conviction_correct integer not null default 0,
  conviction_total integer not null default 0,
  usdc_backed_volume numeric not null default 0,
  unique(user_id, category)
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists market_posts_status_idx on public.market_posts(status);
create index if not exists market_posts_deadline_idx on public.market_posts(deadline);
create index if not exists votes_market_id_idx on public.votes(market_id);
create index if not exists comments_post_id_idx on public.comments(post_id);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.market_posts enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.reshares enable row level security;
alter table public.reputation enable row level security;

create policy "profiles are publicly readable" on public.profiles for select using (true);
create policy "profiles can be created by wallet clients" on public.profiles for insert with check (true);
create policy "profiles can be edited by wallet clients" on public.profiles for update using (true) with check (true);

create policy "posts are publicly readable" on public.posts for select using (true);
create policy "posts can be created by wallet clients" on public.posts for insert with check (true);

create policy "market posts are publicly readable" on public.market_posts for select using (true);
create policy "market posts can be created by wallet clients" on public.market_posts for insert with check (true);
create policy "market post counters can be updated by wallet clients" on public.market_posts for update using (true) with check (true);

create policy "votes are publicly readable" on public.votes for select using (true);
create policy "votes can be written by wallet clients" on public.votes for insert with check (true);
create policy "votes can be changed by wallet clients" on public.votes for update using (true) with check (true);

create policy "comments are publicly readable" on public.comments for select using (true);
create policy "comments can be created by wallet clients" on public.comments for insert with check (true);

create policy "likes are publicly readable" on public.likes for select using (true);
create policy "likes can be created by wallet clients" on public.likes for insert with check (true);
create policy "likes can be removed by wallet clients" on public.likes for delete using (true);

create policy "reshares are publicly readable" on public.reshares for select using (true);
create policy "reshares can be created by wallet clients" on public.reshares for insert with check (true);
create policy "reshares can be removed by wallet clients" on public.reshares for delete using (true);

create policy "reputation is publicly readable" on public.reputation for select using (true);
create policy "reputation can be created by wallet clients" on public.reputation for insert with check (true);
create policy "reputation can be updated by wallet clients" on public.reputation for update using (true) with check (true);
