"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import ComposeBox from "@/components/feed/ComposeBox"
import { type FeedTabId } from "@/components/feed/FeedTabs"
import MarketCard from "@/components/post/MarketCard"
import PostCard from "@/components/post/PostCard"
import CommentModal from "@/components/social/CommentModal"
import { useDailyVotes } from "@/hooks/useDailyVotes"
import { useFeed } from "@/hooks/useFeed"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useMarketLiquidity } from "@/hooks/useMarketLiquidity"
import { useSocket } from "@/hooks/useSocket"
import { Swords, Timer, ChevronRight } from "lucide-react"
import {
  displayHandle,
  displayName,
  getMarketPrice,
  relativeTime,
  TRADING_FEE_BPS,
  type FeedPost,
  type MarketPost,
  type VoteSide,
  type Profile,
} from "@/lib/verity"
import {
  useToggleLikeMutation,
  useToggleReshareMutation,
  useCastFreeVoteMutation,
} from "@/store/verity/verityQueries"
import { toast } from "@/lib/toast"

const FEED_CATEGORIES = [
  "Crypto",
  "Culture",
  "Economics",
  "Miscellaneous",
  "Politics",
  "Sports",
] as const

type FeedCategory = (typeof FEED_CATEGORIES)[number]

export default function FeedShell() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<FeedTabId>("for-you")
  const [activeCategory, setActiveCategory] = useState<FeedCategory | null>(
    null,
  )
  const { profile } = useWalletProfile()
  const { dailyVotes, refetch: reloadDailyVotes } = useDailyVotes(profile?.id)
  const { items, loading, error, reload } = useFeed(
    profile?.id,
    activeTab === "markets",
  )

  const { joinRoom, leaveRoom } = useSocket()

  useEffect(() => {
    joinRoom("feed")
    if (profile?.id) {
      joinRoom(`user:${profile.id}`)
    }
    return () => {
      leaveRoom("feed")
      if (profile?.id) {
        leaveRoom(`user:${profile.id}`)
      }
    }
  }, [profile?.id])

  const [commentingPost, setCommentingPost] = useState<FeedPost | null>(null)
  const { mutateAsync: toggleLike } = useToggleLikeMutation()
  const { mutateAsync: toggleReshare } = useToggleReshareMutation()
  const { mutateAsync: castFreeVote } = useCastFreeVoteMutation()
  const { fundPreMarket, addPoolLiquidity, buyTokens } = useMarketLiquidity()
  const [lpLoading, setLpLoading] = useState<string | null>(null)

  async function handleAddLP(market: MarketPost, amount: number) {
    if (!profile) {
      toast.error("Connect a wallet before taking that action.")
      return
    }
    setLpLoading(market.id)
    try {
      const isPoolActive = market.status === "tradable"
      if (!isPoolActive) {
        await fundPreMarket(market.id, profile.id, amount, false)
      } else {
        await addPoolLiquidity(market.id, profile.id, amount)
      }
      await reload()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Failed to add liquidity.",
      )
    } finally {
      setLpLoading(null)
    }
  }

  async function handleBuySide(
    market: MarketPost,
    side: VoteSide,
    amount: number,
  ) {
    if (!profile) {
      toast.error("Connect a wallet before taking that action.")
      return
    }
    setLpLoading(market.id)
    try {
      const isYes = side === "YES"
      const feeBps = market.trading_fee_bps ?? TRADING_FEE_BPS
      const feeAmount = (amount * feeBps) / 10000
      const selectedPrice = getMarketPrice(market, side)
      const grossAmount = amount / selectedPrice

      await buyTokens(
        market.id,
        profile.id,
        isYes,
        amount,
        feeAmount,
        grossAmount,
      )
      await reload()
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Failed to buy tokens.",
      )
    } finally {
      setLpLoading(null)
    }
  }

  const visibleItems = useMemo(() => {
    const activeItems = items.filter((item) => {
      if (item.type === "market" && item.market) {
        const isResolved =
          item.market.status === "resolved" ||
          item.market.status === "voided" ||
          (item.market.category?.toLowerCase() === "pvp" &&
            (() => {
              const children =
                item.market.childMarkets || item.market.child_markets || []
              return (
                children.length > 0 &&
                children.every(
                  (child: any) =>
                    child.status === "resolved" ||
                    child.status === "voided" ||
                    child.resolvedOutcome,
                )
              )
            })())

        if (isResolved) {
          return false
        }
      }
      return true
    })
    if (!activeCategory) return activeItems
    return activeItems.filter(
      (item) => item.market?.category === activeCategory,
    )
  }, [activeCategory, items])

  async function runAction(action: () => Promise<unknown>) {
    if (!profile) {
      toast.error("Connect a wallet before taking that action.")
      return
    }

    try {
      await action()
      await Promise.all([reload(), reloadDailyVotes()])
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Action failed.")
    }
  }

  async function sharePost(post: FeedPost) {
    const text = post.market?.question || post.content
    const url = post.market
      ? `${window.location.origin}/markets/${post.market.id}`
      : `${window.location.origin}/`

    if (navigator.share) {
      await navigator.share({ title: "Verity", text, url })
      return
    }

    await navigator.clipboard.writeText(`${text}\n${url}`)
    toast.success("Link copied to clipboard!")
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
            Upvote or Downvote early signals, then trade YES/NO once a market
            earns enough conviction.
          </p>
        </div>
      </section>

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
          <FeedSkeleton />
        ) : visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <FeedCard
              item={item}
              key={item.id}
              dailyVotesRemaining={dailyVotes.votesRemaining}
              onLike={() =>
                runAction(() =>
                  toggleLike({
                    postId: item.id,
                    profileId: profile!.id,
                    currentlyLiked: item.viewerLiked,
                  }),
                )
              }
              onOpenMarket={(market) => {
                if (market.category?.toLowerCase() === "pvp") {
                  router.push("/markets?tab=pvp-arena")
                } else {
                  router.push(`/markets/${market.id}`)
                }
              }}
              onOpenPost={(post) => router.push(`/posts/${post.id}`)}
              onReshare={() =>
                runAction(() =>
                  toggleReshare({
                    postId: item.id,
                    profileId: profile!.id,
                    currentlyReshared: item.viewerReshared,
                  }),
                )
              }
              onShare={() => sharePost(item)}
              onUsdcVote={(market, side, amount) =>
                handleBuySide(market, side, amount)
              }
              onVote={(market, side) =>
                runAction(() =>
                  castFreeVote({
                    marketId: market.id,
                    userId: profile!.id,
                    side,
                  }),
                )
              }
              isConnected={Boolean(profile)}
              actionLoading={lpLoading}
              onAddLP={handleAddLP}
              profile={profile}
              onComment={() => {
                if (!profile) {
                  toast.error("Connect a wallet to leave a comment.")
                  return
                }
                setCommentingPost(item)
              }}
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

      <CommentModal
        post={commentingPost}
        isOpen={Boolean(commentingPost)}
        onClose={() => setCommentingPost(null)}
      />
    </div>
  )
}

function FeedCard({
  item,
  dailyVotesRemaining,
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
  profile,
  onComment,
}: {
  item: FeedPost
  dailyVotesRemaining: number
  onLike: () => void
  onOpenMarket: (market: MarketPost) => void
  onOpenPost: (post: FeedPost) => void
  onReshare: () => void
  onShare: () => void
  onUsdcVote: (market: MarketPost, side: VoteSide, amount: number) => void
  onVote: (market: MarketPost, side: VoteSide) => void
  isConnected: boolean
  actionLoading: string | null
  onAddLP: (market: MarketPost, amount: number) => Promise<void>
  profile: Profile | null
  onComment: () => void
}) {
  const isPvp = item.market?.category?.toLowerCase() === "pvp"

  const renderContent = () => {
    if (item.type === "market" && item.market) {
      if (isPvp) {
        return (
          <article
            onClick={() => onOpenMarket(item.market!)}
            className="verity-card p-5 border border-indigo-200 dark:border-indigo-950 bg-indigo-50/20 hover:border-indigo-400 dark:hover:border-indigo-800 transition-all cursor-pointer group relative flex flex-col justify-between"
          >
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider shadow-subtle">
              <Swords className="h-3 w-3" />
              PvP Matchup
            </div>

            <div>
              <span className="font-mono text-[10px] font-bold text-ash uppercase tracking-wider">
                World Cup Arena
              </span>
              <h3 className="text-xl font-bold tracking-tight text-charcoal-primary dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {item.market.question}
              </h3>
              <p className="text-xs text-graphite dark:text-zinc-400 mt-2 leading-relaxed">
                Predict all propositions for the match. Battle head-to-head for
                Arena XP, boosts, and bragging rights.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-dashed border-indigo-100 dark:border-indigo-950/60 pt-3">
              <div className="flex items-center gap-2 font-mono text-[10px] text-ash">
                <Timer className="h-3.5 w-3.5" />
                <span>
                  Closes: {new Date(item.market.deadline).toLocaleDateString()}
                </span>
              </div>
              <span className="flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Predict Now
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </article>
        )
      }

      const market = item.market!
      const totalUsdc =
        Number(market.usdc_yes_amount || 0) + Number(market.usdc_no_amount || 0)
      const yesPercent =
        totalUsdc > 0
          ? (Number(market.usdc_yes_amount || 0) / totalUsdc) * 100
          : 50

      return (
        <MarketCard
          category={market.category}
          comments={item.commentsCount}
          dailyVotesRemaining={dailyVotesRemaining}
          deadline={new Date(market.deadline).toLocaleDateString()}
          freeNoVotes={market.free_no_votes}
          freeYesVotes={market.free_yes_votes}
          handle={displayHandle(item.author)}
          liquidity={market.liquidity}
          marketCreationFeeUsdc={market.market_creation_fee_usdc}
          name={displayName(item.author)}
          noCondition={market.no_condition}
          onOpenDetails={() => onOpenMarket(market)}
          postContent={item.content}
          profile={item.author}
          profileHref={`/profile/${encodeURIComponent(item.author.id)}`}
          question={market.question}
          resolutionSource={market.resolution_source}
          reshares={item.resharesCount}
          status={market.status}
          time={relativeTime(item.created_at)}
          totalFreeVotes={market.totalFreeVotes}
          usdcNo={Number(market.usdc_no_amount)}
          usdcYes={Number(market.usdc_yes_amount)}
          viewerVote={item.viewerVote}
          yesCondition={market.yes_condition}
          yesPercent={yesPercent}
          outcomeCount={market.outcomeCount}
          outcomes={market.outcomes}
          outcomePrices={market.outcomePrices}
          minimumPoolBalance={market.minimumPoolBalance || market.minimum_pool_balance}
          isConnected={isConnected}
          actionLoading={actionLoading === market.id}
          onAddLP={(amount) => onAddLP(market, amount)}
          onVote={(side) => onVote(market, side)}
          onUsdcVote={(side, amount) => onUsdcVote(market, side, amount)}
          onComment={onComment}
          onReshare={onReshare}
          onShare={onShare}
          reshared={item.viewerReshared}
        />
      )
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
    )
  }

  return <div className="flex flex-col gap-2">{renderContent()}</div>
}

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="verity-card p-4 sm:p-5 flex gap-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-stone-surface" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-24 rounded bg-stone-surface" />
              <div className="h-3 w-16 rounded bg-stone-surface" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 w-3/4 rounded bg-stone-surface" />
              <div className="h-4 w-5/6 rounded bg-stone-surface" />
              <div className="h-4 w-1/2 rounded bg-stone-surface" />
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-stone-surface pt-3 max-w-[360px]">
              <div className="h-5 w-8 rounded bg-stone-surface" />
              <div className="h-5 w-8 rounded bg-stone-surface" />
              <div className="h-5 w-8 rounded bg-stone-surface" />
              <div className="h-5 w-8 rounded bg-stone-surface" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
