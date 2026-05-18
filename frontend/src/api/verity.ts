import { apiRequest } from "@/api/client";
import type {
  FeedPost,
  MarketComment,
  MarketInput,
  MarketPosition,
  MarketPost,
  MarketTrade,
  MarketTradeAction,
  VoteSide,
} from "@/lib/verity";

export function fetchFeed(viewerProfileId?: string, onlyMarkets = false) {
  const params = new URLSearchParams();
  if (viewerProfileId) params.set("userId", viewerProfileId);
  if (onlyMarkets) params.set("onlyMarkets", "true");

  const query = params.toString();
  return apiRequest<FeedPost[]>(`/feed${query ? `?${query}` : ""}`);
}

export async function createNormalPost(profileId: string, content: string) {
  await apiRequest<unknown>("/posts/normal", {
    method: "POST",
    body: JSON.stringify({ authorId: profileId, content }),
  });
}

export async function createMarketPost(profileId: string, input: MarketInput) {
  return apiRequest<{ post: FeedPost; warning: string | null }>("/posts/market", {
    method: "POST",
    body: JSON.stringify({ authorId: profileId, ...input }),
  });
}

export async function toggleLike(postId: string, profileId: string, currentlyLiked: boolean) {
  await apiRequest<null>(`/posts/${postId}/like`, {
    method: "POST",
    body: JSON.stringify({ userId: profileId, currentlyActive: currentlyLiked }),
  });
}

export async function toggleReshare(postId: string, profileId: string, currentlyReshared: boolean) {
  await apiRequest<null>(`/posts/${postId}/reshare`, {
    method: "POST",
    body: JSON.stringify({ userId: profileId, currentlyActive: currentlyReshared }),
  });
}

export async function addComment(postId: string, profileId: string, content: string) {
  await apiRequest<null>(`/posts/${postId}/comment`, {
    method: "POST",
    body: JSON.stringify({ authorId: profileId, content }),
  });
}

export function fetchPostComments(postId: string) {
  return apiRequest<MarketComment[]>(`/comments?postId=${encodeURIComponent(postId)}`);
}

export function fetchMarketPositions(marketId: string, profileId: string) {
  return apiRequest<MarketPosition[]>(
    `/markets/${marketId}/positions?profileId=${encodeURIComponent(profileId)}`,
  );
}

export function fetchMarketTrades(marketId: string) {
  return apiRequest<MarketTrade[]>(`/markets/${marketId}/trades`);
}

export async function castFreeVote(market: MarketPost, profileId: string, side: VoteSide) {
  return apiRequest<{ market: MarketPost; dailyVotes: { votesLimit: number; votesUsed: number; votesRemaining: number; date: string } }>(`/markets/${market.id}/vote`, {
    method: "POST",
    body: JSON.stringify({ userId: profileId, side }),
  });
}

export function approveMarketForTrading(marketId: string) {
  return apiRequest<MarketPost>(`/markets/${marketId}/approve-trading`, {
    method: "POST",
  });
}

export async function executeMarketTrade({
  market,
  profileId,
  side,
  action,
  amount,
  feeAmount,
  grossAmount,
  txHash,
}: {
  market: MarketPost;
  profileId: string;
  side: VoteSide;
  action: MarketTradeAction;
  amount: number;
  feeAmount?: number;
  grossAmount?: number;
  txHash?: string | null;
}) {
  await apiRequest<null>(`/markets/${market.id}/trade`, {
    method: "POST",
    body: JSON.stringify({ profileId, side, action, amount, feeAmount, grossAmount, txHash }),
  });
}
