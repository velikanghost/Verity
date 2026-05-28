'use client'

import { useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import MarketCard from '@/components/post/MarketCard'
import PostCard from '@/components/post/PostCard'
import CommentsThread from '@/components/social/CommentsThread'
import { useFeed } from '@/hooks/useFeed'
import { useSetRightPanelSlot } from '@/hooks/useRightPanelSlot'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import { useSocket } from '@/hooks/useSocket'
import {
  displayHandle,
  displayName,
  relativeTime,
  type FeedPost,
  type MarketPost,
} from '@/lib/verity'
import { usePostCommentsQuery, usePostQuery } from '@/store/verity/verityQueries'

interface PostDetailViewProps {
  postId: string
}

export default function PostDetailView({ postId }: PostDetailViewProps) {
  const router = useRouter()
  const { profile } = useWalletProfile()
  const { joinRoom, leaveRoom } = useSocket()
  const { items, loading: feedLoading } = useFeed()
  const { data: item, isLoading: itemLoading, error: itemError } = usePostQuery(postId, profile?.id)
  const { data: comments = [], isLoading: commentsLoading } =
    usePostCommentsQuery(postId)

  useEffect(() => {
    joinRoom(`post:${postId}`)
    return () => {
      leaveRoom(`post:${postId}`)
    }
  }, [postId, joinRoom, leaveRoom])

  useEffect(() => {
    if (item?.market?.id) {
      router.replace(`/markets/${item.market.id}`)
    }
  }, [item, router])

  const relatedMarkets = useMemo(() => {
    const category = item?.market?.category
    return items
      .filter((feedItem) => feedItem.market && feedItem.id !== postId)
      .filter((feedItem) =>
        category ? feedItem.market?.category === category : true,
      )
      .slice(0, 3)
  }, [item, items, postId])

  useSetRightPanelSlot(
    <RelatedMarketsPanel
      items={relatedMarkets}
      onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
    />,
    `${postId}-${relatedMarkets.map((related) => related.id).join(',')}`,
  )

  if (itemLoading) {
    return (
      <div className="flex flex-col gap-3 py-4 animate-pulse">
        <div className="h-10 w-24 rounded bg-stone-surface" />
        <div className="verity-card p-4 sm:p-5 flex gap-4">
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
      </div>
    )
  }

  if (itemError) {
    return (
      <div className="py-4">
        <section className="rounded-[12px] bg-ember-orange/10 p-8 text-center text-sm text-charcoal-primary shadow-[(--shadow-subtle)]">
          {(itemError as any)?.message || "Failed to load post."}
        </section>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="py-4">
        <section className="verity-card p-8 text-center text-sm text-ash">
          Post not found.
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <Link
        className="verity-pill flex h-10 w-fit items-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] transition-colors hover:bg-stone-surface"
        href="/"
      >
        <ArrowLeft className="h-4 w-4" />
        Feed
      </Link>

      <PostDetailCard
        item={item}
        onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
      />

      <CommentsThread postId={postId} comments={comments} loading={commentsLoading} />

      <div className="lg:hidden">
        <RelatedMarketsPanel
          items={relatedMarkets}
          onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
        />
      </div>
    </div>
  )
}

function PostDetailCard({
  item,
  onOpenMarket,
}: {
  item: FeedPost
  onOpenMarket: (market: MarketPost) => void
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
        variant="detail"
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
      profile={item.author}
      profileHref={`/profile/${encodeURIComponent(item.author.id)}`}
      reshares={item.resharesCount}
      reshared={item.viewerReshared}
      time={relativeTime(item.created_at)}
    />
  )
}

function RelatedMarketsPanel({
  items,
  onOpenMarket,
}: {
  items: FeedPost[]
  onOpenMarket: (market: MarketPost) => void
}) {
  return (
    <section className="verity-card overflow-hidden">
      <div className="border-b border-dashed border-stone-surface p-4">
        <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
          <TrendingUp className="h-4 w-4 text-meadow-green" />
          Related Markets
        </h2>
      </div>
      {items.length > 0 ? (
        items.map((item) => (
          <button
            className="block w-full border-b border-dashed border-stone-surface p-4 text-left transition-colors last:border-b-0 hover:bg-parchment-card"
            key={item.id}
            onClick={() => item.market && onOpenMarket(item.market)}
            type="button"
          >
            <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.18px] text-charcoal-primary">
              {item.market?.question}
            </p>
            <p className="mt-2 font-mono text-xs text-ash">
              {item.market?.category || 'Market'}
            </p>
          </button>
        ))
      ) : (
        <div className="p-4 text-sm tracking-[-0.18px] text-ash">
          No related markets yet.
        </div>
      )}
    </section>
  )
}
