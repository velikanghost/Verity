import { formatDistanceToNow } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type PostType = "normal" | "market";
export type VoteSide = "YES" | "NO";

export interface Profile {
  id: string;
  wallet_address: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface MarketPost {
  id: string;
  post_id: string;
  question: string;
  category: string;
  deadline: string;
  resolution_source: string;
  yes_condition: string;
  no_condition: string;
  status: string;
  free_yes_votes: number;
  free_no_votes: number;
  usdc_yes_amount: number;
  usdc_no_amount: number;
  market_creation_fee_usdc?: number;
  trading_fee_bps?: number;
  creation_fee_tx_hash?: string | null;
  fee_collector_address?: string | null;
  created_at: string;
}

export interface FeedPost {
  id: string;
  author_id: string;
  type: PostType;
  content: string;
  created_at: string;
  author: Profile;
  market: MarketPost | null;
  commentsCount: number;
  likesCount: number;
  resharesCount: number;
  viewerLiked: boolean;
  viewerReshared: boolean;
  viewerVote: VoteSide | null;
}

interface RawFeedPost {
  id: string;
  author_id: string;
  type: PostType;
  content: string;
  created_at: string;
  author: Profile | null;
  market_posts: MarketPost[] | MarketPost | null;
  comments: { id: string }[] | null;
  likes: { id: string }[] | null;
  reshares: { id: string }[] | null;
}

export interface MarketInput {
  content: string;
  question: string;
  category: string;
  deadline: string;
  resolutionSource: string;
  yesCondition: string;
  noCondition: string;
  creationFeeTxHash?: string;
  feeCollectorAddress?: string;
}

function requireClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function normalizeWallet(address: string) {
  return address.trim().toLowerCase();
}

function defaultUsername(address: string) {
  return `user_${address.slice(-4).toLowerCase()}_${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function displayName(profile?: Profile | null) {
  if (!profile) return "Unknown";
  return profile.display_name || profile.username || "Unknown";
}

export function displayHandle(profile?: Profile | null) {
  if (!profile?.username) return "@unknown";
  return `@${profile.username}`;
}

export function relativeTime(value: string) {
  try {
    return `${formatDistanceToNow(new Date(value), { addSuffix: false })} ago`;
  } catch {
    return "now";
  }
}

export async function getOrCreateProfile(walletAddress: string) {
  const supabase = requireClient();
  const wallet = normalizeWallet(walletAddress);

  const existing = await supabase
    .from("profiles")
    .select("*")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as Profile;

  const created = await supabase
    .from("profiles")
    .insert({
      wallet_address: wallet,
      username: defaultUsername(wallet),
      display_name: `User ${wallet.slice(-4).toUpperCase()}`,
    })
    .select("*")
    .single();

  if (created.error) throw created.error;
  return created.data as Profile;
}

export async function updateProfile(
  profileId: string,
  input: Pick<Profile, "username" | "display_name" | "avatar_url" | "bio">,
) {
  const supabase = requireClient();
  const result = await supabase
    .from("profiles")
    .update({
      username: input.username,
      display_name: input.display_name,
      avatar_url: input.avatar_url,
      bio: input.bio,
    })
    .eq("id", profileId)
    .select("*")
    .single();

  if (result.error) throw result.error;
  return result.data as Profile;
}

export async function fetchFeed(viewerProfileId?: string, onlyMarkets = false) {
  const supabase = requireClient();
  const query = supabase
    .from("posts")
    .select(
      `
      id,
      author_id,
      type,
      content,
      created_at,
      author:profiles(*),
      market_posts(*),
      comments(id),
      likes(id),
      reshares(id)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (onlyMarkets) query.eq("type", "market");

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as unknown as RawFeedPost[];
  const postIds = rows.map((row) => row.id);
  const marketIds = rows
    .map((row) => normalizeMarket(row.market_posts)?.id)
    .filter(Boolean) as string[];

  const [likedIds, resharedIds, votes] = await Promise.all([
    viewerProfileId ? fetchViewerIds(supabase, "likes", "post_id", postIds, viewerProfileId) : Promise.resolve(new Set<string>()),
    viewerProfileId ? fetchViewerIds(supabase, "reshares", "post_id", postIds, viewerProfileId) : Promise.resolve(new Set<string>()),
    viewerProfileId ? fetchViewerVotes(supabase, marketIds, viewerProfileId) : Promise.resolve(new Map<string, VoteSide>()),
  ]);
  return rows.map((row) => {
    const market = normalizeMarket(row.market_posts);

    return {
      id: row.id,
      author_id: row.author_id,
      type: row.type,
      content: row.content,
      created_at: row.created_at,
      author: row.author || fallbackProfile(row.author_id),
      market,
      commentsCount: row.comments?.length || 0,
      likesCount: row.likes?.length || 0,
      resharesCount: row.reshares?.length || 0,
      viewerLiked: likedIds.has(row.id),
      viewerReshared: resharedIds.has(row.id),
      viewerVote: market ? votes.get(market.id) || null : null,
    } satisfies FeedPost;
  });
}

function normalizeMarket(value: RawFeedPost["market_posts"]) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function fallbackProfile(authorId: string): Profile {
  return {
    id: authorId,
    wallet_address: null,
    username: "unknown",
    display_name: "Unknown",
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
  };
}

async function fetchViewerIds(
  supabase: SupabaseClient,
  table: "likes" | "reshares",
  column: "post_id",
  ids: string[],
  profileId: string,
) {
  if (ids.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq("user_id", profileId)
    .in(column, ids);

  if (error) throw error;
  return new Set((data || []).map((row) => row[column] as string));
}

async function fetchViewerVotes(
  supabase: SupabaseClient,
  marketIds: string[],
  profileId: string,
) {
  if (marketIds.length === 0) return new Map<string, VoteSide>();

  const { data, error } = await supabase
    .from("votes")
    .select("market_id, side")
    .eq("user_id", profileId)
    .in("market_id", marketIds);

  if (error) throw error;
  return new Map((data || []).map((row) => [row.market_id as string, row.side as VoteSide]));
}

export async function createNormalPost(profileId: string, content: string) {
  const supabase = requireClient();
  const { error } = await supabase.from("posts").insert({
    author_id: profileId,
    type: "normal",
    content: content.trim(),
  });

  if (error) throw error;
}

export async function createMarketPost(profileId: string, input: MarketInput) {
  const supabase = requireClient();
  const post = await supabase
    .from("posts")
    .insert({
      author_id: profileId,
      type: "market",
      content: input.content.trim() || input.question.trim(),
    })
    .select("id")
    .single();

  if (post.error) throw post.error;

  const market = await supabase.from("market_posts").insert({
    post_id: post.data.id,
    question: input.question.trim(),
    category: input.category.trim(),
    deadline: new Date(input.deadline).toISOString(),
    resolution_source: input.resolutionSource.trim(),
    yes_condition: input.yesCondition.trim(),
    no_condition: input.noCondition.trim(),
    status: "open",
    creation_fee_tx_hash: input.creationFeeTxHash || null,
    fee_collector_address: input.feeCollectorAddress || null,
  });

  if (market.error) throw market.error;
}

export async function toggleLike(postId: string, profileId: string, currentlyLiked: boolean) {
  const supabase = requireClient();

  const result = currentlyLiked
    ? await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", profileId)
    : await supabase.from("likes").insert({ post_id: postId, user_id: profileId });

  if (result.error) throw result.error;
}

export async function toggleReshare(postId: string, profileId: string, currentlyReshared: boolean) {
  const supabase = requireClient();

  const result = currentlyReshared
    ? await supabase.from("reshares").delete().eq("post_id", postId).eq("user_id", profileId)
    : await supabase.from("reshares").insert({ post_id: postId, user_id: profileId });

  if (result.error) throw result.error;
}

export async function addComment(postId: string, profileId: string, content: string) {
  const supabase = requireClient();
  const trimmed = content.trim();
  if (!trimmed) return;

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: profileId,
    content: trimmed,
  });

  if (error) throw error;
}

export async function castFreeVote(market: MarketPost, profileId: string, side: VoteSide) {
  const supabase = requireClient();
  const closed = market.status !== "open" || new Date(market.deadline).getTime() <= Date.now();
  if (closed) throw new Error("This market is closed.");

  const vote = await supabase.from("votes").upsert(
    {
      market_id: market.id,
      user_id: profileId,
      side,
      vote_type: "free",
      amount: 0,
    },
    { onConflict: "market_id,user_id,vote_type" },
  );

  if (vote.error) throw vote.error;

  const { data, error } = await supabase
    .from("votes")
    .select("side")
    .eq("market_id", market.id)
    .eq("vote_type", "free");

  if (error) throw error;

  const yes = (data || []).filter((row) => row.side === "YES").length;
  const no = (data || []).filter((row) => row.side === "NO").length;

  const counter = await supabase
    .from("market_posts")
    .update({ free_yes_votes: yes, free_no_votes: no })
    .eq("id", market.id);

  if (counter.error) throw counter.error;
}

export async function castUsdcVote({
  market,
  profileId,
  side,
  amount,
  feeAmount,
  grossAmount,
  txHash,
}: {
  market: MarketPost;
  profileId: string;
  side: VoteSide;
  amount: number;
  feeAmount: number;
  grossAmount: number;
  txHash: string;
}) {
  const supabase = requireClient();
  const closed = market.status !== "open" || new Date(market.deadline).getTime() <= Date.now();
  if (closed) throw new Error("This market is closed.");
  if (amount <= 0) throw new Error("Enter a USDC amount greater than 0.");

  const vote = await supabase.from("votes").upsert(
    {
      market_id: market.id,
      user_id: profileId,
      side,
      vote_type: "usdc",
      amount,
      fee_amount: feeAmount,
      gross_amount: grossAmount,
      tx_hash: txHash,
    },
    { onConflict: "market_id,user_id,vote_type" },
  );

  if (vote.error) throw vote.error;

  const { data, error } = await supabase
    .from("votes")
    .select("side, amount")
    .eq("market_id", market.id)
    .eq("vote_type", "usdc");

  if (error) throw error;

  const yes = (data || [])
    .filter((row) => row.side === "YES")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const no = (data || [])
    .filter((row) => row.side === "NO")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const counter = await supabase
    .from("market_posts")
    .update({ usdc_yes_amount: yes, usdc_no_amount: no })
    .eq("id", market.id);

  if (counter.error) throw counter.error;
}
