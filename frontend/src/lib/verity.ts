import { formatDistanceToNow } from "date-fns";

export type PostType = "normal" | "market" | "comment";
export type VoteSide = "YES" | "NO";
export type MarketTradeAction = "BUY" | "SELL";

export interface Profile {
  id: string;
  wallet_address: string | null;
  walletAddress?: string | null;
  username: string;
  display_name: string | null;
  displayName?: string | null;
  avatar_url: string | null;
  avatarUrl?: string | null;
  bio: string | null;
  followersCount?: number;
  followingCount?: number;
  signalPoints?: number;
  freeVotesCorrect?: number;
  freeVotesWrong?: number;
  freeVotesTotal?: number;
  created_at: string;
  createdAt?: string;
  updatedAt?: string;
  isOnboarded?: boolean;
}

export interface MarketPost {
  id: string;
  post_id: string;
  postId?: string;
  question: string;
  category: string;
  deadline: string;
  resolution_source: string;
  resolutionSource?: string;
  yes_condition: string;
  yesCondition?: string;
  no_condition: string;
  noCondition?: string;
  status: string;
  free_yes_votes: number;
  freeYesVotes?: number;
  free_no_votes: number;
  freeNoVotes?: number;
  totalFreeVotes?: number;
  uniqueVotersCount?: number;
  qualificationThreshold?: number;
  uniqueVoterThreshold?: number;
  usdc_yes_amount: number;
  usdcYesAmount?: number;
  usdc_no_amount: number;
  usdcNoAmount?: number;
  liquidity?: number;
  market_creation_fee_usdc?: number;
  creationFeeTxHash?: string | null;
  creation_fee_tx_hash?: string | null;
  feeCollectorAddress?: string | null;
  fee_collector_address?: string | null;
  trading_fee_bps?: number;
  resolvedOutcome?: string | null;
  resolved_outcome?: string | null;
  resolvedByAdmin?: string | null;
  resolved_by_admin?: string | null;
  isPythMarket?: boolean;
  is_pyth_market?: boolean;
  priceFeedId?: string | null;
  price_feed_id?: string | null;
  targetPrice?: number | null;
  target_price?: number | null;
  resolveAbove?: boolean;
  resolve_above?: boolean;
  proposalReasoning?: string | null;
  proposalCitations?: string[] | null;
  proposalProposer?: string | null;
  proposalDisputer?: string | null;
  disputed?: boolean;
  proposedOutcome?: boolean | null;
  created_at: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FeedPost {
  id: string;
  author_id: string;
  authorId?: string;
  type: PostType;
  content: string;
  created_at: string;
  createdAt?: string;
  updatedAt?: string;
  author: Profile;
  market: MarketPost | null;
  commentsCount: number;
  likesCount: number;
  resharesCount: number;
  sharesCount?: number;
  viewerLiked: boolean;
  viewerReshared: boolean;
  viewerVote: VoteSide | null;
  parentPost?: FeedPost | null;
}

export interface MarketComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: Profile;
  parentId?: string;
  parent_id?: string;
}

export interface MarketPosition {
  id: string;
  market_id: string;
  user_id: string;
  side: VoteSide;
  shares: number;
  avg_price: number;
  invested_usdc: number;
  realized_pnl: number;
  created_at: string;
  updated_at: string;
  market_question?: string | null;
}

export interface MarketTrade {
  id: string;
  market_id: string;
  user_id: string;
  side: VoteSide;
  action: MarketTradeAction;
  shares: number;
  price: number;
  amount_usdc: number;
  fee_usdc: number;
  gross_usdc: number;
  tx_hash: string | null;
  created_at: string;
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
  priceFeedId?: string;
  targetPrice?: number;
  resolveAbove?: boolean;
  marketId?: string;
}

export function displayName(profile?: Profile | null) {
  if (!profile) return "Unknown";
  return profile.display_name || profile.displayName || profile.username || "Unknown";
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

export const MARKET_CREATION_FEE_USDC = 1;
export const TRADING_FEE_BPS = 200;

export function formatTradingFee(bps = TRADING_FEE_BPS) {
  return `${(bps / 100).toFixed(1)}%`;
}

export function calculateTradingFee(amount: number, bps = TRADING_FEE_BPS) {
  return amount * (bps / 10_000);
}

export function calculateGrossUsdc(amount: number, bps = TRADING_FEE_BPS) {
  return amount + calculateTradingFee(amount, bps);
}

const MIN_MARKET_PRICE = 0.01;
const MAX_MARKET_PRICE = 0.99;

function clampMarketPrice(price: number) {
  if (!Number.isFinite(price)) return 0.5;
  return Math.min(MAX_MARKET_PRICE, Math.max(MIN_MARKET_PRICE, price));
}

export function getMarketPrice(market: Pick<MarketPost, "usdc_yes_amount" | "usdc_no_amount">, side: VoteSide) {
  const yes = Number(market.usdc_yes_amount);
  const no = Number(market.usdc_no_amount);
  const total = yes + no;
  const yesPrice = total > 0 ? yes / total : 0.5;
  return clampMarketPrice(side === "YES" ? yesPrice : 1 - yesPrice);
}

export function calculateYesPercent(market: Pick<MarketPost, "usdc_yes_amount" | "usdc_no_amount">) {
  const yes = Number(market.usdc_yes_amount);
  const no = Number(market.usdc_no_amount);
  const total = yes + no;
  if (total === 0) return 50;
  return Math.round((yes / total) * 100);
}
