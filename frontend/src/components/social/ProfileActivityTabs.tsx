'use client'

import { useMemo } from 'react'
import MarketCard from '@/components/post/MarketCard'
import PostCard from '@/components/post/PostCard'
import {
  displayHandle,
  displayName,
  relativeTime,
  type FeedPost,
  type MarketPost,
  type Profile,
} from '@/lib/verity'

export type ProfileActivityTab = 'posts' | 'markets' | 'comments' | 'likes' | 'reshares'

interface ProfileActivityTabsProps {
  activeTab: ProfileActivityTab
  items: FeedPost[]
  profile: Profile
  onOpenMarket: (market: MarketPost) => void
  onOpenPost?: (post: FeedPost) => void
}

export default function ProfileActivityTabs({
  activeTab,
  items,
  profile,
  onOpenMarket,
  onOpenPost,
}: ProfileActivityTabsProps) {
  // Items are pre-filtered by the backend when using the profile activity query.
  const rows = items

  if (activeTab === 'comments') {
    return (
      <section className="flex flex-col gap-3">
        {rows.length > 0 ? (
          rows.map((item) => (
            <CommentActivityRow item={item} key={item.id} profile={profile} />
          ))
        ) : (
          <EmptyActivity tab={activeTab} />
        )}
      </section>
    )
  }

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
        <EmptyActivity tab={activeTab} />
      )}
    </section>
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
  if (item.market) {
    const market = item.market
    const totalUsdc = Number(market.usdc_yes_amount) + Number(market.usdc_no_amount)
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

function CommentActivityRow({
  item,
  profile,
}: {
  item: FeedPost
  profile: Profile
}) {
  const title = item.market?.question || item.content

  return (
    <article className="verity-card p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">
        Comment activity
      </p>
      <p className="mt-2 text-sm tracking-[-0.18px] text-graphite">
        {displayName(profile)} has discussion activity on:
      </p>
      <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-[1.35] tracking-[-0.2px] text-charcoal-primary">
        {title}
      </p>
      <p className="mt-3 font-mono text-xs text-ash">
        {item.commentsCount} comments
      </p>
    </article>
  )
}

function EmptyActivity({ tab }: { tab: ProfileActivityTab }) {
  const label =
    tab === 'posts'
      ? 'posts'
      : tab === 'markets'
        ? 'markets'
        : tab === 'comments'
          ? 'comments'
          : tab === 'reshares'
            ? 'reshares'
            : 'liked posts or markets'

  return (
    <div className="verity-card p-8 text-center text-sm tracking-[-0.18px] text-ash">
      No {label} yet.
    </div>
  )
}
