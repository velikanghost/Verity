'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import MarketCard from '@/components/post/MarketCard'
import PostCard from '@/components/post/PostCard'
import CommentsThread from '@/components/social/CommentsThread'
import { useFeed } from '@/hooks/useFeed'
import { useSetRightPanelSlot } from '@/hooks/useRightPanelSlot'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import {
  displayHandle,
  displayName,
  relativeTime,
  type FeedPost,
  type MarketPost,
} from '@/lib/verity'
import { usePostCommentsQuery } from '@/store/verity/verityQueries'

interface PostDetailViewProps {
  postId: string
}

export default function PostDetailView({ postId }: PostDetailViewProps) {
  const router = useRouter()
  const { profile } = useWalletProfile()
  const { items, loading, error } = useFeed(profile?.id)
  const item = items.find((feedItem) => feedItem.id === postId)
  const { data: comments = [], isLoading: commentsLoading } =
    usePostCommentsQuery(postId)

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

  if (loading && !item) {
    return (
      <div className="py-4">
        <section className="verity-card p-8 text-center text-sm text-ash">
          Loading post...
        </section>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="py-4">
        <section className="rounded-[12px] bg-ember-orange/10 p-8 text-center text-sm text-charcoal-primary shadow-[var(--shadow-subtle)]">
          {error}
        </section>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="py-4">
        <section className="verity-card p-8 text-center text-sm text-ash">
          Post not found in the current feed.
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <Link
        className="verity-pill flex h-10 w-fit items-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
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
