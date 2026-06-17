"use client"

import React, { useState } from "react"
import Link from "next/link"
import UserHoverCard from "@/components/social/UserHoverCard"
import MarketCard from "@/components/post/MarketCard"
import PostCard from "@/components/post/PostCard"
import { FeedSkeleton } from "@/components/feed/FeedShell"
import {
  displayHandle,
  displayName,
  relativeTime,
  getMarketPrice,
  type FeedPost,
  type MarketPost,
  type Profile,
  type MarketPosition,
} from "@/lib/verity"
import { useRouter } from "next/navigation"
import { ArrowUpRight, Swords, Timer, ChevronRight } from "lucide-react"

export type ProfileActivityTab = "predictions" | "markets" | "activity"

interface ProfileActivityTabsProps {
  activeTab: ProfileActivityTab
  items?: FeedPost[]
  positions?: MarketPosition[]
  profile: Profile
  onOpenMarket: (market: MarketPost) => void
  onOpenPost?: (post: FeedPost) => void
  loading?: boolean
}

export default function ProfileActivityTabs({
  activeTab,
  items = [],
  positions = [],
  profile,
  onOpenMarket,
  onOpenPost,
  loading = false,
}: ProfileActivityTabsProps) {
  const [predictionFilter, setPredictionFilter] = useState<"all" | "unresolved" | "resolved" | "won" | "lost">("all")

  if (loading) {
    return <FeedSkeleton />
  }

  if (activeTab === "predictions") {
    const filteredPositions = positions.filter((pos) => {
      if (predictionFilter === "resolved") return pos.status === "resolved"
      if (predictionFilter === "unresolved") return pos.status !== "resolved"
      if (predictionFilter === "won") return pos.status === "resolved" && pos.resolved_outcome === pos.side
      if (predictionFilter === "lost") return pos.status === "resolved" && pos.resolved_outcome !== pos.side && pos.resolved_outcome !== null
      return true
    })

    return (
      <section className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          {(["all", "unresolved", "resolved", "won", "lost"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setPredictionFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                predictionFilter === filter
                  ? "bg-black/10 dark:bg-white/10 text-charcoal-primary dark:text-white font-bold"
                  : "bg-stone-surface dark:bg-stone-800/50 text-ash dark:text-stone-400 font-bold hover:text-charcoal-primary dark:hover:text-white"
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
        {filteredPositions.length > 0 ? (
          filteredPositions.map((pos) => {
            const isYes = pos.side === "YES"
            const currentPrice =
              pos.status === "resolved"
                ? pos.resolved_outcome === pos.side
                  ? 1.0
                  : 0.0
                : getMarketPrice(
                    {
                      usdc_yes_amount: pos.usdc_yes_amount ?? 0,
                      usdc_no_amount: pos.usdc_no_amount ?? 0,
                    },
                    pos.side,
                  )
            const currentValue = pos.shares * currentPrice
            const unrealizedPnL = currentValue - (pos.invested_usdc || 0)

            const isPvp = pos.category?.toLowerCase() === "pvp"
            const href = isPvp
              ? "/markets?tab=pvp-arena"
              : `/markets/${pos.market_id}`

            return (
              <div
                key={pos.id}
                className="flex flex-col gap-3 p-4 bg-stone-surface rounded-[12px] border border-border sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <span
                    className={`verity-pill inline-flex items-center px-2 py-0.5 font-mono text-[9px] font-semibold ${
                      isYes
                        ? "bg-meadow-green/10 text-meadow-green"
                        : "bg-ember-orange/10 text-ember-orange"
                    }`}
                  >
                    {pos.side}
                  </span>
                  <h4
                    className="mt-1.5 text-xs font-semibold leading-normal text-charcoal-primary truncate"
                    title={pos.market_question || ""}
                  >
                    {pos.market_question ||
                      `Market ID: ${pos.market_id.slice(0, 10)}`}
                  </h4>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs text-right shrink-0">
                  <div>
                    <span className="block text-[8px] text-ash uppercase">
                      Shares
                    </span>
                    <span className="font-semibold text-charcoal-primary">
                      {pos.shares.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-ash uppercase">
                      Cost
                    </span>
                    <span className="font-semibold text-charcoal-primary">
                      ${pos.invested_usdc.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-ash uppercase">
                      P&L
                    </span>
                    <span
                      className={`font-semibold ${unrealizedPnL >= 0 ? "text-meadow-green" : "text-ember-orange"}`}
                    >
                      {unrealizedPnL >= 0 ? "+" : ""}
                      {unrealizedPnL.toFixed(2)}
                    </span>
                  </div>
                  <Link
                    href={href}
                    className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white border border-border hover:bg-stone-surface transition-colors cursor-pointer text-ash hover:text-charcoal-primary"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })
        ) : (
          <div className="verity-card p-8 text-center text-sm tracking-[-0.18px] text-ash">
            No {predictionFilter !== "all" ? predictionFilter : ""} predictions found.
          </div>
        )}
      </section>
    )
  }

  if (activeTab === "activity") {
    const rows = items
    return (
      <section className="flex flex-col gap-3">
        {rows.length > 0 ? (
          rows.map((item) => (
            <CommentActivityRow
              item={item}
              key={item.id}
              profile={profile}
              onOpenMarket={onOpenMarket}
              onOpenPost={onOpenPost}
            />
          ))
        ) : (
          <div className="verity-card p-8 text-center text-sm tracking-[-0.18px] text-ash">
            No activity comments or replies recorded yet.
          </div>
        )}
      </section>
    )
  }

  // Default is "markets" tab (custom created markets by user)
  const rows = items
  return (
    <section className="flex flex-col gap-3">
      {rows.length > 0 ? (
        rows.map((item) => (
          <ActivityItem
            item={item}
            key={item.id}
            onOpenMarket={onOpenMarket}
            onOpenPost={onOpenPost}
          />
        ))
      ) : (
        <div className="verity-card p-8 text-center text-sm tracking-[-0.18px] text-ash">
          No created markets yet.
        </div>
      )}
    </section>
  )
}

function CommentActivityRow({
  item,
  profile,
  onOpenMarket,
  onOpenPost,
}: {
  item: FeedPost
  profile: Profile
  onOpenMarket: (market: MarketPost) => void
  onOpenPost?: (post: FeedPost) => void
}) {
  const profileHref = `/profile/${encodeURIComponent(item.author.id)}`
  const avatarColor = "bg-sunburst-yellow"

  return (
    <article className="verity-card flex gap-3 p-4 sm:gap-4 sm:p-5">
      <div className="shrink-0">
        {profileHref ? (
          <UserHoverCard href={profileHref} profile={item.author}>
            <Link
              className={`clickable verity-blob h-10 w-10 ${avatarColor}`}
              href={profileHref}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="verity-blob-smile" />
            </Link>
          </UserHoverCard>
        ) : (
          <div className={`verity-blob h-10 w-10 ${avatarColor}`}>
            <span className="verity-blob-smile" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-sm">
          {profileHref ? (
            <UserHoverCard href={profileHref} profile={item.author}>
              <Link
                className="clickable-link truncate font-semibold tracking-[-0.18px] text-charcoal-primary"
                href={profileHref}
                onClick={(event) => event.stopPropagation()}
              >
                {displayName(item.author)}
              </Link>
            </UserHoverCard>
          ) : (
            <span className="truncate font-semibold tracking-[-0.18px] text-charcoal-primary hover:underline">
              {displayName(item.author)}
            </span>
          )}
          {profileHref ? (
            <Link
              className="clickable-link truncate font-mono text-xs text-ash"
              href={profileHref}
              onClick={(event) => event.stopPropagation()}
            >
              {displayHandle(item.author)}
            </Link>
          ) : (
            <span className="truncate font-mono text-xs text-ash">
              {displayHandle(item.author)}
            </span>
          )}
          <span className="text-ash">{"\u00B7"}</span>
          <span className="font-mono text-xs text-ash hover:underline">
            {relativeTime(item.created_at)}
          </span>
        </div>

        {item.parentPost?.author && (
          <div className="mb-2 text-xs font-mono text-ash">
            Replying to{" "}
            <span className="text-graphite font-semibold">
              @{displayHandle(item.parentPost.author)}
            </span>
          </div>
        )}

        <p className="mb-4 whitespace-pre-wrap text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
          {item.content}
        </p>

        {item.parentPost && (
          <div
            className="border border-stone-surface rounded-xl overflow-hidden hover:bg-stone-surface/30 transition-colors duration-200 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (item.parentPost?.market) {
                onOpenMarket(item.parentPost.market)
              } else if (item.parentPost) {
                onOpenPost?.(item.parentPost)
              }
            }}
          >
            <div className="p-3.5 sm:p-4">
              <div className="flex items-center gap-1.5 text-xs mb-1.5">
                <span className="font-semibold text-charcoal-primary">
                  {displayName(item.parentPost.author)}
                </span>
                <span className="font-mono text-ash">
                  {displayHandle(item.parentPost.author)}
                </span>
              </div>
              {item.parentPost.market ? (
                <div>
                  <span className="font-mono text-[10px] font-bold text-meadow-green uppercase tracking-wider block mb-1">
                    Market
                  </span>
                  <h4 className="text-[14px] font-semibold text-charcoal-primary leading-[1.3] mb-1">
                    {item.parentPost.market.question}
                  </h4>
                  <p className="text-xs text-ash line-clamp-2">
                    {item.parentPost.content}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-graphite line-clamp-3 leading-[1.4]">
                  {item.parentPost.content}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function ActivityItem({
  item,
  onOpenMarket,
  onOpenPost,
}: {
  item: FeedPost
  onOpenMarket: (market: MarketPost) => void
  onOpenPost?: (post: FeedPost) => void
}) {
  const router = useRouter()
  if (item.market) {
    const market = item.market
    const isPvp = market.category?.toLowerCase() === "pvp"

    if (isPvp) {
      return (
        <article
          onClick={() => {
            const pId =
              market.parentMarketId || market.parent_market_id || market.id
            router.push(`/markets?tab=pvp-arena&id=${pId}`)
          }}
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
              {market.question}
            </h3>
            <p className="text-xs text-graphite dark:text-zinc-400 mt-2 leading-relaxed font-sans">
              Predict all propositions for the match. Battle head-to-head for
              Arena XP, boosts, and bragging rights.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-dashed border-indigo-100 dark:border-indigo-950/60 pt-3">
            <div className="flex items-center gap-2 font-mono text-[10px] text-ash">
              <Timer className="h-3.5 w-3.5" />
              <span>
                Closes: {new Date(market.deadline).toLocaleDateString()}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-sans">
              Predict Now
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </article>
      )
    }

    const totalUsdc =
      Number(market.usdc_yes_amount) + Number(market.usdc_no_amount)
    const yesPercent =
      totalUsdc > 0 ? (Number(market.usdc_yes_amount) / totalUsdc) * 100 : 50

    return (
      <MarketCard
        category={market.category}
        comments={item.commentsCount}
        dailyVotesRemaining={10}
        deadline={new Date(market.deadline).toLocaleString()}
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
      onOpenDetails={() => onOpenPost?.(item)}
      profile={item.author}
      profileHref={`/profile/${encodeURIComponent(item.author.id)}`}
      reshares={item.resharesCount}
      reshared={item.viewerReshared}
      time={relativeTime(item.created_at)}
    />
  )
}
