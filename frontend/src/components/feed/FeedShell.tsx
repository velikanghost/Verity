"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ComposeBox from "@/components/feed/ComposeBox";
import FeedTabs, { type FeedTabId } from "@/components/feed/FeedTabs";
import MarketCard from "@/components/post/MarketCard";
import PostCard from "@/components/post/PostCard";
import { useDailyVotes } from "@/hooks/useDailyVotes";
import { useFeed } from "@/hooks/useFeed";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { useMarketLiquidity } from "@/hooks/useMarketLiquidity";
import {
  displayHandle,
  displayName,
  getMarketPrice,
  relativeTime,
  TRADING_FEE_BPS,
  type FeedPost,
  type MarketPost,
  type VoteSide,
} from "@/lib/verity";
import {
  useAddCommentMutation,
  useToggleLikeMutation,
  useToggleReshareMutation,
  useCastFreeVoteMutation,
} from "@/store/verity/verityQueries";
import { toast } from "react-hot-toast";

const FEED_CATEGORIES = [
  "Crypto",
  "Culture",
  "Economics",
  "Miscellaneous",
  "Politics",
  "Sports",
] as const;

type FeedCategory = (typeof FEED_CATEGORIES)[number];

export default function FeedShell() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FeedTabId>("for-you");
  const [activeCategory, setActiveCategory] = useState<FeedCategory | null>(null);
  const { profile } = useWalletProfile();
  const { dailyVotes, refetch: reloadDailyVotes } = useDailyVotes(profile?.id);
  const { items, loading, error, reload } = useFeed(profile?.id, activeTab === "markets");

  const { mutateAsync: addComment } = useAddCommentMutation();
  const { mutateAsync: toggleLike } = useToggleLikeMutation();
  const { mutateAsync: toggleReshare } = useToggleReshareMutation();
  const { mutateAsync: castFreeVote } = useCastFreeVoteMutation();
  const { fundPreMarket, addPoolLiquidity, buyTokens } = useMarketLiquidity();
  const [lpLoading, setLpLoading] = useState<string | null>(null);

  async function handleAddLP(market: MarketPost, amount: number) {
    if (!profile) {
      toast.error("Connect a wallet before taking that action.");
      return;
    }
    setLpLoading(market.id);
    try {
      const isPoolActive = market.status === "tradable";
      if (!isPoolActive) {
        await fundPreMarket(market.id, profile.id, amount, false);
      } else {
        await addPoolLiquidity(market.id, profile.id, amount);
      }
      toast.success("Liquidity added successfully!");
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Failed to add liquidity.");
    } finally {
      setLpLoading(null);
    }
  }

  async function handleBuySide(market: MarketPost, side: VoteSide, amount: number) {
    if (!profile) {
      toast.error("Connect a wallet before taking that action.");
      return;
    }
    setLpLoading(market.id);
    try {
      const isYes = side === "YES";
      const feeBps = market.trading_fee_bps ?? TRADING_FEE_BPS;
      const feeAmount = (amount * feeBps) / 10000;
      const selectedPrice = getMarketPrice(market, side);
      const grossAmount = amount / selectedPrice;

      await buyTokens(
        market.id,
        profile.id,
        isYes,
        amount,
        feeAmount,
        grossAmount
      );
      toast.success(`Successfully bought ${side} tokens!`);
      await reload();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Failed to buy tokens.");
    } finally {
      setLpLoading(null);
    }
  }

  const visibleItems = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter((item) => item.market?.category === activeCategory);
  }, [activeCategory, items]);

  async function runAction(action: () => Promise<unknown>) {
    if (!profile) {
      toast.error("Connect a wallet before taking that action.");
      return;
    }

    try {
      await action();
      await Promise.all([reload(), reloadDailyVotes()]);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  async function commentOn(post: FeedPost) {
    const content = window.prompt("Add a comment");
    if (!content) return;
    await runAction(() => addComment({ postId: post.id, authorId: profile!.id, content }));
  }

  async function sharePost(post: FeedPost) {
    const text = post.market?.question || post.content;
    const url = post.market ? `${window.location.origin}/markets/${post.market.id}` : `${window.location.origin}/`;

    if (navigator.share) {
      await navigator.share({ title: "Verity", text, url });
      return;
    }

    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success("Link copied to clipboard!");
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <section className="verity-card relative overflow-hidden p-4 sm:p-5">
        <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-sunburst-yellow/40" />
        <div className="absolute right-12 top-7 hidden sm:block">
          <span className="verity-blob block h-12 w-14 rotate-6 bg-meadow-green">
            <span className="verity-blob-smile" />
          </span>
        </div>
        <div className="relative max-w-[430px]">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ember-orange">
            Social prediction market
          </p>
          <h1 className="text-[30px] font-semibold leading-[1.06] tracking-[-0.7px] text-midnight sm:text-[44px] sm:tracking-[-1.14px]">
            Back takes. Build markets.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
            Upvote or Downvote early signals, then trade YES/NO once a market earns enough conviction.
          </p>
        </div>
      </section>

      <div className="verity-card p-3">
        <div className="mb-2 text-xs font-semibold tracking-[-0.12px] text-charcoal-primary">Category</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FEED_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                aria-pressed={isActive}
                className={`verity-pill h-9 shrink-0 px-4 text-sm font-medium tracking-[-0.18px] transition-opacity ${
                  isActive
                    ? "bg-inverse text-inverse-text"
                    : "bg-parchment-card text-graphite shadow-[var(--shadow-subtle)] hover:bg-stone-surface"
                }`}
                key={category}
                onClick={() => setActiveCategory(isActive ? null : category)}
                type="button"
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <ComposeBox onCreated={reload} profile={profile} />

      {error && (
        <div className="verity-card p-4 text-sm font-medium text-graphite">
          {error}
        </div>
      )}

      <div
        aria-labelledby={`feed-tab-${activeTab}`}
        aria-live="polite"
        className="flex flex-col gap-3 pb-20 sm:pb-0"
        id="feed-panel"
        role="tabpanel"
      >
        {loading ? (
          <div className="verity-card p-8 text-center text-sm font-medium text-ash">
            Loading feed...
          </div>
        ) : visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <FeedCard
              item={item}
              key={item.id}
              dailyVotesRemaining={dailyVotes.votesRemaining}
              onComment={() => commentOn(item)}
              onLike={() => runAction(() => toggleLike({ postId: item.id, profileId: profile!.id, currentlyLiked: item.viewerLiked }))}
              onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
              onOpenPost={(post) => router.push(`/posts/${post.id}`)}
              onReshare={() => runAction(() => toggleReshare({ postId: item.id, profileId: profile!.id, currentlyReshared: item.viewerReshared }))}
              onShare={() => sharePost(item)}
              onUsdcVote={(market, side, amount) => handleBuySide(market, side, amount)}
              onVote={(market, side) => runAction(() => castFreeVote({ marketId: market.id, userId: profile!.id, side }))}
              isConnected={Boolean(profile)}
              actionLoading={lpLoading}
              onAddLP={handleAddLP}
            />
          ))
        ) : (
          <div className="verity-card flex flex-col items-center gap-3 p-8 text-center text-sm font-medium text-ash">
            <span className="verity-blob block h-16 w-20 bg-sky-blue">
              <span className="verity-blob-smile" />
            </span>
            No feed items yet.
          </div>
        )}
      </div>
    </div>
  );
}

function FeedCard({
  item,
  dailyVotesRemaining,
  onComment,
  onLike,
  onOpenMarket,
  onOpenPost,
  onReshare,
  onShare,
  onUsdcVote,
  onVote,
  isConnected,
  actionLoading,
  onAddLP,
}: {
  item: FeedPost;
  dailyVotesRemaining: number;
  onComment: () => void;
  onLike: () => void;
  onOpenMarket: (market: MarketPost) => void;
  onOpenPost: (post: FeedPost) => void;
  onReshare: () => void;
  onShare: () => void;
  onUsdcVote: (market: MarketPost, side: VoteSide, amount: number) => void;
  onVote: (market: MarketPost, side: VoteSide) => void;
  isConnected: boolean;
  actionLoading: string | null;
  onAddLP: (market: MarketPost, amount: number) => Promise<void>;
}) {
  if (item.type === "market" && item.market) {
    const yesPercent = calculateYesPercent(item.market);

    return (
      <MarketCard
        category={item.market.category}
        comments={item.commentsCount}
        deadline={new Date(item.market.deadline).toLocaleString()}
        freeNoVotes={item.market.free_no_votes}
        freeYesVotes={item.market.free_yes_votes}
        handle={displayHandle(item.author)}
        marketCreationFeeUsdc={item.market.market_creation_fee_usdc}
        name={displayName(item.author)}
        noCondition={item.market.no_condition}
        onComment={onComment}
        onOpenDetails={() => onOpenMarket(item.market!)}
        onReshare={onReshare}
        onShare={onShare}
        onUsdcVote={(side, amount) => onUsdcVote(item.market!, side, amount)}
        onVote={(side) => onVote(item.market!, side)}
        postContent={item.content}
        profile={item.author}
        profileHref={`/profile/${encodeURIComponent(item.author.id)}`}
        question={item.market.question}
        resolutionSource={item.market.resolution_source}
        reshares={item.resharesCount}
        reshared={item.viewerReshared}
        status={item.market.status}
        time={relativeTime(item.created_at)}
        dailyVotesRemaining={dailyVotesRemaining}
        qualificationThreshold={item.market.qualificationThreshold}
        totalFreeVotes={item.market.totalFreeVotes}
        tradingFeeBps={item.market.trading_fee_bps}
        uniqueVoterThreshold={item.market.uniqueVoterThreshold}
        uniqueVotersCount={item.market.uniqueVotersCount}
        usdcNo={Number(item.market.usdc_no_amount)}
        usdcYes={Number(item.market.usdc_yes_amount)}
        viewerVote={item.viewerVote}
        votingDisabledMessage={
          dailyVotesRemaining <= 0 ? "You have used all 10 Upvote/Downvote signals today. They reset tomorrow." : null
        }
        yesCondition={item.market.yes_condition}
        yesPercent={yesPercent}
        liquidity={item.market.liquidity}
        actionLoading={Boolean(actionLoading && actionLoading.startsWith(item.market.id))}
        actionLoadingStatus={actionLoading && actionLoading.startsWith(item.market.id) ? actionLoading.replace(`${item.market.id}_`, "") : null}
        isConnected={isConnected}
        onAddLP={(amount) => onAddLP(item.market!, amount)}
      />
    );
  }

  return (
    <PostCard
      comments={item.commentsCount}
      content={item.content}
      handle={displayHandle(item.author)}
      liked={item.viewerLiked}
      likes={item.likesCount}
      name={displayName(item.author)}
      onComment={onComment}
      onOpenDetails={() => onOpenPost(item)}
      onLike={onLike}
      onReshare={onReshare}
      onShare={onShare}
      reshares={item.resharesCount}
      reshared={item.viewerReshared}
      time={relativeTime(item.created_at)}
      profile={item.author}
      profileHref={`/profile/${encodeURIComponent(item.author.id)}`}
    />
  );
}

function calculateYesPercent(market: MarketPost) {
  const yes = Number(market.usdc_yes_amount);
  const no = Number(market.usdc_no_amount);
  const totalUsdc = yes + no;
  if (totalUsdc > 0) return (yes / totalUsdc) * 100;

  return 50;
}
