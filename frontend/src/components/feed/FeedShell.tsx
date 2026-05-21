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
import {
  displayHandle,
  displayName,
  relativeTime,
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
    <div className="flex flex-col gap-3 py-3">
      <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-3 shadow-sm">
        <div className="mb-2 text-xs font-black text-[(--foreground)]">Category</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FEED_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                aria-pressed={isActive}
                className={`h-9 shrink-0 rounded-[8px] border px-4 text-sm transition-colors ${
                  isActive
                    ? "border-[(--border-strong)] bg-[(--surface-muted)] text-[(--foreground)]"
                    : "border-[(--border)] bg-[(--surface-solid)] text-[(--foreground)] hover:border-[(--border-strong)]"
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
        <div className="rounded-[18px] border border-[(--color-brand-accent)]/30 bg-[(--color-brand-accent)]/10 p-4 text-sm font-medium text-[(--foreground)]">
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
          <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-8 text-center text-sm font-medium text-[(--muted)] shadow-sm">
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
              onReshare={() => runAction(() => toggleReshare({ postId: item.id, profileId: profile!.id, currentlyReshared: item.viewerReshared }))}
              onShare={() => sharePost(item)}
              onUsdcVote={(market) => router.push(`/markets/${market.id}`)}
              onVote={(market, side) => runAction(() => castFreeVote({ marketId: market.id, userId: profile!.id, side }))}
            />
          ))
        ) : (
          <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-8 text-center text-sm font-medium text-[(--muted)] shadow-sm">
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
  onReshare,
  onShare,
  onUsdcVote,
  onVote,
}: {
  item: FeedPost;
  dailyVotesRemaining: number;
  onComment: () => void;
  onLike: () => void;
  onOpenMarket: (market: MarketPost) => void;
  onReshare: () => void;
  onShare: () => void;
  onUsdcVote: (market: MarketPost, side: VoteSide, amount: number) => void;
  onVote: (market: MarketPost, side: VoteSide) => void;
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
          dailyVotesRemaining <= 0 ? "You have used all 10 votes today. Votes reset tomorrow." : null
        }
        yesCondition={item.market.yes_condition}
        yesPercent={yesPercent}
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
      onLike={onLike}
      onReshare={onReshare}
      onShare={onShare}
      reshares={item.resharesCount}
      reshared={item.viewerReshared}
      time={relativeTime(item.created_at)}
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
