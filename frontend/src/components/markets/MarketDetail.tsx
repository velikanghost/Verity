'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Info,
  MessageCircle,
  Repeat2,
  Share,
  ShieldCheck,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import VerityAgentPanel from '@/components/markets/VerityAgentPanel'
import { useDailyVotes } from '@/hooks/useDailyVotes'
import { useFeed } from '@/hooks/useFeed'
import { useSetRightPanelSlot } from '@/hooks/useRightPanelSlot'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import {
  calculateGrossUsdc,
  calculateTradingFee,
  formatTradingFee,
} from '@/lib/verity'
import {
  displayHandle,
  displayName,
  getMarketPrice,
  relativeTime,
  type FeedPost,
  type MarketComment,
  type MarketPosition,
  type MarketTradeAction,
  type MarketPost,
  type VoteSide,
} from '@/lib/verity'
import {
  useAddCommentMutation,
  useApproveMarketForTradingMutation,
  useCastFreeVoteMutation,
  useMarketPositionsQuery,
  usePostCommentsQuery,
  useToggleReshareMutation,
  useDevQualifyMutation,
  useLPPositionsQuery,
  usePoolStateQuery,
  useMarketTradesQuery,
  useResolveMarketMutation,
} from '@/store/verity/verityQueries'
import { useMarketLiquidity } from '@/hooks/useMarketLiquidity'
import { useMarketResolution } from '@/hooks/useMarketResolution'

interface MarketDetailProps {
  marketId: string
}

export default function MarketDetail({ marketId }: MarketDetailProps) {
  const { profile } = useWalletProfile()
  const queryClient = useQueryClient()
  const balance = useUsdcBalance()

  const profileId = profile?.id
  const isConnected = Boolean(profileId)

  // 1. All hooks and state declarations at the very top of the component
  const [actionPending, setActionPending] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [tradeAmount, setTradeAmount] = useState('1')
  const [tradeAction, setTradeAction] = useState<MarketTradeAction>('BUY')
  const [selectedSide, setSelectedSide] = useState<VoteSide>('YES')

  const { dailyVotes, refetch: reloadDailyVotes } = useDailyVotes(profileId)
  const { items, loading, error, reload } = useFeed(profileId, true)

  const item = items.find((feedItem) => feedItem.market?.id === marketId)
  const market = item?.market || null
  const postId = item?.id
  const detailMarketId = market?.id

  const { data: poolStateData } = usePoolStateQuery(detailMarketId || '')
  const { data: lpPositionsData } = useLPPositionsQuery(
    detailMarketId || '',
    profileId || '',
  )
  const { data: fetchedTrades } = useMarketTradesQuery(detailMarketId || '')
  const { data: fetchedComments } = usePostCommentsQuery(postId || '')
  const { data: fetchedPositions } = useMarketPositionsQuery(
    detailMarketId || '',
    profileId || '',
  )

  const { mutateAsync: addComment } = useAddCommentMutation()
  const { mutateAsync: approveMarketForTrading } =
    useApproveMarketForTradingMutation()
  const { mutateAsync: castFreeVote } = useCastFreeVoteMutation()
  const { mutateAsync: toggleReshare } = useToggleReshareMutation()
  const { mutateAsync: devQualifyMarket } = useDevQualifyMutation()

  const {
    fundPreMarket,
    addPoolLiquidity,
    removePoolLiquidity,
    buyTokens,
    sellTokens,
  } = useMarketLiquidity()
  const { disputeResolution, redeemWinnings, claimCreatorLP } =
    useMarketResolution()
  const { mutateAsync: resolveMarketBackend } = useResolveMarketMutation()

  // 2. All derived values based on the hook state declarations
  const poolYesPrice = poolStateData?.prices?.yesPrice
  const poolNoPrice = poolStateData?.prices?.noPrice

  const yesPercent = useMemo(() => {
    if (poolYesPrice != null) return poolYesPrice * 100
    return market ? calculateYesPercent(market) : 50
  }, [poolYesPrice, market])

  const noPercent = useMemo(() => {
    if (poolNoPrice != null) return poolNoPrice * 100
    return 100 - yesPercent
  }, [poolNoPrice, yesPercent])

  const totalUsdc = useMemo(() => {
    if ((poolStateData?.pool?.currentPoolBalance ?? 0) > 0) {
      return poolStateData.pool.currentPoolBalance
    }
    return market
      ? Number(market.usdc_yes_amount) + Number(market.usdc_no_amount)
      : 0
  }, [poolStateData, market])

  const hasUsdcOpinion = totalUsdc > 0

  const tradeAmountNumber = Number(tradeAmount)
  const validTradeAmount =
    Number.isFinite(tradeAmountNumber) && tradeAmountNumber > 0
  const selectedPrice = market ? getMarketPrice(market, selectedSide) : 0.5
  const buyShares = validTradeAmount ? tradeAmountNumber / selectedPrice : 0
  const sellProceeds = validTradeAmount ? tradeAmountNumber * selectedPrice : 0
  const tradeBaseAmount =
    tradeAction === 'BUY' ? tradeAmountNumber : sellProceeds
  const tradeFee =
    market && validTradeAmount
      ? calculateTradingFee(tradeBaseAmount, market.trading_fee_bps)
      : 0
  const tradeTotal =
    market && validTradeAmount
      ? tradeAction === 'BUY'
        ? calculateGrossUsdc(tradeAmountNumber, market.trading_fee_bps)
        : Math.max(0, sellProceeds - tradeFee)
      : 0

  const leadingSide: VoteSide = yesPercent >= noPercent ? 'YES' : 'NO'
  const leadingPercent = Math.max(yesPercent, noPercent)

  const createdAt = useMemo(
    () => (market ? new Date(market.created_at) : null),
    [market],
  )
  const closesAt = useMemo(
    () => (market ? new Date(market.deadline) : null),
    [market],
  )
  const settlesAt = useMemo(
    () =>
      closesAt ? new Date(closesAt.getTime() + 24 * 60 * 60 * 1000) : null,
    [closesAt],
  )

  const isPastDeadline = useMemo(() => {
    if (!closesAt) return false
    return new Date() >= closesAt
  }, [closesAt])

  const creatorMarkets = useMemo(() => {
    return items.filter((feedItem) => feedItem.author_id === item?.author_id)
      .length
  }, [item, items])

  const creatorTotalVolume = useMemo(() => {
    if (!item?.author_id) return 0
    return items
      .filter((feedItem) => feedItem.author_id === item.author_id)
      .reduce(
        (sum, feedItem) =>
          sum +
          (feedItem.market?.liquidity ??
            Number(feedItem.market?.usdc_yes_amount || 0) +
              Number(feedItem.market?.usdc_no_amount || 0)),
        0,
      )
  }, [item, items])

  const comments = fetchedComments || []
  const positions = fetchedPositions || []
  const trades = fetchedTrades || []

  const volume = useMemo(() => {
    return trades.reduce((sum, t) => sum + Number(t.amount_usdc || 0), 0)
  }, [trades])

  const liveLiquidity = useMemo(() => {
    return (
      poolStateData?.pool?.currentPoolBalance ?? market?.liquidity ?? totalUsdc
    )
  }, [poolStateData, market, totalUsdc])

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      if (!profileId) {
        toast.error('Connect your wallet first.')
        return
      }

      setActionPending(true)

      try {
        await action()
        await Promise.all([
          reload(),
          reloadDailyVotes(),
          queryClient.invalidateQueries({
            queryKey: ['pool-state', detailMarketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['lp-positions', detailMarketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['positions', detailMarketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['trades', detailMarketId],
          }),
        ])
      } catch (caught) {
        const msg = caught instanceof Error ? caught.message : 'Action failed.'
        toast.error(msg.slice(0, 120))
      } finally {
        setActionPending(false)
      }
    },
    [profileId, reload, reloadDailyVotes, queryClient, detailMarketId],
  )

  const handleDispute = useCallback(async () => {
    if (!market || !profileId) return
    await runAction(async () => {
      await disputeResolution(market.id)
    })
  }, [market, profileId, disputeResolution, runAction])

  const handleRedeem = useCallback(async () => {
    if (!market || !profileId) return
    await runAction(async () => {
      const { txHash } = await redeemWinnings(market.id)
      const winningOutcome = market.resolvedOutcome || 'YES'
      await resolveMarketBackend({
        marketId: market.id,
        winningOutcome: winningOutcome as 'YES' | 'NO',
        txHash,
        adminAddress: profile?.walletAddress || '0xWinner',
      })
      await balance.refetch()
    })
  }, [
    market,
    profile,
    profileId,
    redeemWinnings,
    resolveMarketBackend,
    runAction,
    balance,
  ])

  const handleClaimCreatorLP = useCallback(async () => {
    if (!market || !profileId) return
    await runAction(async () => {
      await claimCreatorLP(market.id)
    })
  }, [market, profileId, claimCreatorLP, runAction])

  const approveTrading = useCallback(async () => {
    if (!market) return
    await runAction(() => approveMarketForTrading(market.id))
  }, [market, runAction, approveMarketForTrading])

  const handleDevQualify = useCallback(async () => {
    if (!market) return
    await runAction(async () => {
      await devQualifyMarket(market.id)
    })
  }, [market, devQualifyMarket, runAction])

  const handleFundPreMarket = useCallback(
    async (amount: number) => {
      if (!market || !profileId) return
      await runAction(async () => {
        await fundPreMarket(market.id, profileId, amount, true)
      })
    },
    [market, profileId, fundPreMarket, runAction],
  )

  const handleAddLP = useCallback(
    async (amount: number) => {
      if (!market || !profileId) return
      await runAction(async () => {
        const isPoolActive = poolStateData?.pool?.status === 'active'
        if (!isPoolActive) {
          await fundPreMarket(market.id, profileId, amount, false)
        } else {
          await addPoolLiquidity(market.id, profileId, amount)
        }
      })
    },
    [
      market,
      profileId,
      poolStateData,
      fundPreMarket,
      addPoolLiquidity,
      runAction,
    ],
  )

  const handleRemoveLP = useCallback(
    async (shares: number) => {
      if (!market || !profileId) return
      await runAction(async () => {
        await removePoolLiquidity(market.id, profileId, shares)
      })
    },
    [market, profileId, removePoolLiquidity, runAction],
  )

  async function sharePost(post: FeedPost) {
    const text = post.market?.question || post.content
    const url = `${window.location.origin}/markets/${marketId}`

    if (navigator.share) {
      await navigator.share({ title: 'Verity', text, url })
      return
    }

    await navigator.clipboard.writeText(`${text}\n${url}`)
    toast.success('Link copied to clipboard!')
  }

  const executeTrade = useCallback(
    async (side: VoteSide) => {
      if (!market || !profileId) return

      await runAction(async () => {
        const amount = Number(tradeAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Enter a valid USDC amount.')
        }
        const isYes = side === 'YES'
        if (tradeAction === 'BUY') {
          await buyTokens(
            market.id,
            profileId,
            isYes,
            tradeAmountNumber,
            tradeFee,
            buyShares,
          )
        } else {
          await sellTokens(
            market.id,
            profileId,
            isYes,
            amount,
            tradeTotal,
            tradeFee,
          )
        }
      })
    },
    [
      market,
      profileId,
      tradeAmount,
      tradeAction,
      buyTokens,
      sellTokens,
      runAction,
      tradeAmountNumber,
      tradeFee,
      buyShares,
      tradeTotal,
    ],
  )

  async function submitComment() {
    if (!item || !market || !commentDraft.trim()) return
    if (!profile) {
      toast.error('Connect your wallet before commenting.')
      return
    }

    setCommentLoading(true)
    try {
      await addComment({
        postId: item.id,
        authorId: profile.id,
        content: commentDraft,
      })
      setCommentDraft('')
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Comment failed.')
    } finally {
      setCommentLoading(false)
    }
  }

  const sidebarPanels = useMemo(() => {
    if (!market || !postId) return null

    const creatorHandle = item ? displayHandle(item.author) : ''
    const creatorName = item ? displayName(item.author) : ''

    return (
      <>
        <TradeTicket
          action={tradeAction}
          amount={tradeAmount}
          balanceLabel={balance.isLoading ? '...' : balance.formattedBalance}
          disabled={market.status !== 'tradable' || !validTradeAmount}
          estimatedShares={buyShares}
          fee={tradeFee}
          isConnected={isConnected}
          netProceeds={tradeTotal}
          onActionChange={setTradeAction}
          onAmountChange={setTradeAmount}
          onSideChange={setSelectedSide}
          onTrade={() => executeTrade(selectedSide)}
          price={selectedPrice}
          selectedSide={selectedSide}
          sellProceeds={sellProceeds}
          total={tradeTotal}
          yesPrice={yesPercent}
          noPrice={noPercent}
        />

        <MarketStatsPanel
          createdAt={createdAt}
          feeBps={market.trading_fee_bps}
          liquidity={liveLiquidity}
          closesAt={closesAt}
          settlesAt={settlesAt}
          volume={volume}
        />

        <CreatorPanel
          creator={creatorHandle}
          creatorName={creatorName}
          marketsCreated={creatorMarkets}
          totalVolume={creatorTotalVolume}
        />
      </>
    )
  }, [
    market,
    postId,
    item,
    tradeAction,
    tradeAmount,
    balance.isLoading,
    balance.formattedBalance,
    validTradeAmount,
    buyShares,
    tradeFee,
    isConnected,
    tradeTotal,
    selectedPrice,
    selectedSide,
    sellProceeds,
    yesPercent,
    noPercent,
    createdAt,
    liveLiquidity,
    closesAt,
    settlesAt,
    volume,
    creatorMarkets,
    creatorTotalVolume,
    executeTrade,
  ])

  const rightPanelSlot = useMemo(
    () =>
      sidebarPanels ? (
        <div className="flex flex-col gap-3">{sidebarPanels}</div>
      ) : null,
    [sidebarPanels],
  )

  const rightPanelSlotKey = [
    postId || 'no-post',
    detailMarketId || 'no-market',
    profileId || 'disconnected',
    tradeAction,
    tradeAmount,
    selectedSide,
    selectedPrice,
    sellProceeds,
    balance.isLoading ? 'loading' : balance.formattedBalance,
    market?.status || 'unknown',
    market?.trading_fee_bps || 0,
    liveLiquidity,
    volume,
    yesPercent,
    noPercent,
    creatorMarkets,
    creatorTotalVolume,
  ].join('|')

  useSetRightPanelSlot(rightPanelSlot, rightPanelSlotKey)

  if (loading) {
    return (
      <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-8 text-center text-sm font-medium text-[(--muted)] shadow-sm">
        Loading market...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[18px] border border-[(--color-brand-accent)]/30 bg-[(--color-brand-accent)]/10 p-4 text-sm font-medium text-[(--foreground)]">
        {error}
      </div>
    )
  }

  if (!item || !market) {
    return (
      <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-8 text-center text-sm font-medium text-[(--muted)] shadow-sm">
        Market not found.{' '}
        <Link className="font-bold text-[(--foreground)] underline" href="/">
          View feed
        </Link>
      </div>
    )
  }

  const creatorHandle = displayHandle(item.author)

  return (
    <div className="flex flex-col gap-3">
      <MarketHero
        category={market.category}
        creator={creatorHandle}
        leadingPercent={leadingPercent}
        leadingSide={leadingSide}
        market={market}
        question={market.question}
        time={relativeTime(item.created_at)}
        totalVotes={market.free_yes_votes + market.free_no_votes}
      />

      <div className="flex flex-col gap-3 lg:hidden">{sidebarPanels}</div>

      <SentimentPanel
        noPercent={noPercent}
        hasOpinions={hasUsdcOpinion}
        yesPercent={yesPercent}
      />

      {market.status === 'open_for_votes' && (
        <VoteQualificationProgressPanel
          loading={actionPending}
          market={market}
          onDevQualify={handleDevQualify}
        />
      )}

      {market.status === 'funding_pool' && (
        <PreMarketFundingPanel
          actionLoading={actionPending}
          authorId={item.author_id || item.authorId}
          market={market}
          onAddLP={handleAddLP}
          onFundPreMarket={handleFundPreMarket}
          poolState={poolStateData}
          profileId={profileId}
        />
      )}

      {market.status === 'tradable' && (
        <ActiveMarketLPPanel
          actionLoading={actionPending}
          lpPositions={lpPositionsData || []}
          market={market}
          onAddLP={handleAddLP}
          onRemoveLP={handleRemoveLP}
          poolState={poolStateData}
          profileId={profileId}
        />
      )}

      {(market.status === 'resolving' ||
        market.status === 'resolved' ||
        isPastDeadline) && (
        <ResolutionPanel
          market={market}
          onDispute={handleDispute}
          actionLoading={actionPending}
          profileId={profileId}
        />
      )}

      {market.status === 'resolved' && (
        <RedeemPanel
          market={market}
          positions={positions}
          lpPositions={lpPositionsData || []}
          onRedeem={handleRedeem}
          onClaimCreatorLP={handleClaimCreatorLP}
          actionLoading={actionPending}
          profileId={profileId}
        />
      )}

      <RulesPanel
        noCondition={market.no_condition}
        postContent={item.content}
        resolutionSource={market.resolution_source}
        yesCondition={market.yes_condition}
      />

      <VerityAgentPanel market={market} />

      <CreationReviewPanel market={market} onApprove={approveTrading} />

      <PositionPanel
        freeVote={item.viewerVote}
        market={market}
        onSell={(side) => {
          setSelectedSide(side)
          setTradeAction('SELL')
        }}
        positions={positions}
      />

      <CommentsPanel
        commentDraft={commentDraft}
        comments={comments}
        loading={commentLoading}
        onChange={setCommentDraft}
        onSubmit={submitComment}
      />

      <SocialActions
        comments={item.commentsCount}
        freeNoVotes={market.free_no_votes}
        freeYesVotes={market.free_yes_votes}
        dailyVotesRemaining={dailyVotes.votesRemaining}
        marketStatus={market.status}
        onComment={() =>
          document.getElementById('market-comment-input')?.focus()
        }
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
        onVote={(side) =>
          runAction(() =>
            castFreeVote({ marketId: market.id, userId: profile!.id, side }),
          )
        }
        reshares={item.resharesCount}
        reshared={item.viewerReshared}
        viewerVote={item.viewerVote}
      />
    </div>
  )
}

function MarketHero({
  category,
  creator,
  leadingPercent,
  leadingSide,
  market,
  question,
  time,
  totalVotes,
}: {
  category: string
  creator: string
  leadingPercent: number
  leadingSide: VoteSide
  market: MarketPost
  question: string
  time: string
  totalVotes: number
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black leading-tight text-[(--foreground)] sm:text-2xl">
            {question}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-[(--muted)]">
            <span className="rounded-[4px] border border-[(--border)] px-2 py-0.5">
              {category}
            </span>
            <span>by {creator}</span>
            <span>{'\u00B7'}</span>
            <span>{time}</span>
          </div>
        </div>
        <span
          className={`font-mono text-sm font-bold uppercase tracking-wider ${market.status === 'voided' ? 'text-[(--muted)]' : 'text-[(--color-brand-secondary)]'}`}
        >
          {market.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-[(--border)] pt-3 font-mono text-xs text-[(--muted)]">
        <span>
          Leading outcome:{' '}
          <strong
            className={
              leadingSide === 'YES'
                ? 'text-[(--color-brand-secondary)]'
                : 'text-[(--color-brand-accent)]'
            }
          >
            {leadingSide} {leadingPercent.toFixed(1)}%
          </strong>
        </span>
        <span>{totalVotes} free votes</span>
      </div>
    </section>
  )
}

function TradeTicket({
  action,
  amount,
  balanceLabel,
  disabled,
  estimatedShares,
  fee,
  isConnected,
  netProceeds,
  noPrice,
  onActionChange,
  onAmountChange,
  onSideChange,
  onTrade,
  price,
  selectedSide,
  sellProceeds,
  total,
  yesPrice,
}: {
  action: MarketTradeAction
  amount: string
  balanceLabel: string
  disabled: boolean
  estimatedShares: number
  fee: number
  isConnected: boolean
  netProceeds: number
  noPrice: number
  onActionChange: (action: MarketTradeAction) => void
  onAmountChange: (value: string) => void
  onSideChange: (side: VoteSide) => void
  onTrade: () => void
  price: number
  selectedSide: VoteSide
  sellProceeds: number
  total: number
  yesPrice: number
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[(--foreground)]">Place a Trade</h2>
        <span className="font-mono text-[11px] text-[(--muted)]">Arc USDC</span>
      </div>

      <div className="mb-3 grid grid-cols-2 rounded-[8px] bg-[(--surface-muted)] p-1">
        {(['BUY', 'SELL'] as const).map((nextAction) => (
          <button
            aria-pressed={action === nextAction}
            className={`h-9 rounded-[7px] font-mono text-xs font-black uppercase tracking-[0.12em] transition-colors ${
              action === nextAction
                ? 'bg-[(--surface)] text-[(--foreground)] shadow-sm'
                : 'text-[(--muted)] hover:text-[(--foreground)]'
            }`}
            key={nextAction}
            onClick={() => onActionChange(nextAction)}
            type="button"
          >
            {nextAction === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <OutcomeButton
          active={selectedSide === 'YES'}
          label="Yes"
          price={yesPrice}
          side="YES"
          onClick={onSideChange}
        />
        <OutcomeButton
          active={selectedSide === 'NO'}
          label="No"
          price={noPrice}
          side="NO"
          onClick={onSideChange}
        />
      </div>

      <label
        className="mb-2 block font-mono text-[11px] font-bold uppercase text-[(--muted)]"
        htmlFor="market-trade-amount"
      >
        {action === 'BUY'
          ? 'Amount (USDC)'
          : `Shares to sell (${selectedSide})`}
      </label>
      <input
        className="h-11 w-full rounded-[8px] border border-[(--border)] bg-[(--surface-solid)] px-3 font-mono text-sm text-[(--foreground)] outline-none"
        id="market-trade-amount"
        min="0"
        onChange={(event) => onAmountChange(event.target.value)}
        step="0.01"
        type="number"
        value={amount}
      />

      <div className="mt-3 grid gap-1 font-mono text-[11px] text-[(--muted)]">
        <div className="flex justify-between">
          <span>Current balance</span>
          <span>{balanceLabel} USDC</span>
        </div>
        <div className="flex justify-between">
          <span>Price</span>
          <span>{(price * 100).toFixed(1)}¢</span>
        </div>
        <div className="flex justify-between">
          <span>
            {action === 'BUY' ? 'Estimated shares' : 'Gross proceeds'}
          </span>
          <span>
            {action === 'BUY'
              ? estimatedShares.toFixed(4)
              : `${sellProceeds.toFixed(4)} USDC`}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Trading fee</span>
          <span>{fee.toFixed(4)} USDC</span>
        </div>
        <div className="flex justify-between text-[(--foreground)]">
          <span>{action === 'BUY' ? 'Total' : 'Net proceeds'}</span>
          <span>
            {action === 'BUY' ? total.toFixed(4) : netProceeds.toFixed(4)} USDC
          </span>
        </div>
      </div>

      <button
        className="mt-4 flex h-11 w-full items-center justify-center rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled || !isConnected}
        onClick={onTrade}
        type="button"
      >
        {isConnected
          ? `${action === 'BUY' ? 'Buy' : 'Sell'} ${selectedSide}`
          : 'Connect Wallet'}
      </button>
    </section>
  )
}

function OutcomeButton({
  active,
  label,
  onClick,
  price,
  side,
}: {
  active: boolean
  label: string
  onClick: (side: VoteSide) => void
  price: number
  side: VoteSide
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-[8px] border px-3 py-3 text-left transition-colors ${
        active
          ? side === 'YES'
            ? 'border-[(--color-brand-secondary)] bg-[(--color-brand-secondary)]/15'
            : 'border-[(--color-brand-accent)] bg-[(--color-brand-accent)]/15'
          : 'border-[(--border)] bg-[(--surface-muted)] hover:border-[(--border-strong)]'
      }`}
      onClick={() => onClick(side)}
      type="button"
    >
      <span className="block text-sm font-black text-[(--foreground)]">
        {label}
      </span>
      <span className="font-mono text-[11px] text-[(--muted)]">
        {price.toFixed(1)}¢ implied
      </span>
    </button>
  )
}

function SentimentPanel({
  noPercent,
  hasOpinions,
  yesPercent,
}: {
  noPercent: number
  hasOpinions: boolean
  yesPercent: number
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-black text-[(--foreground)]">Market Sentiment</h2>
          <p className="mt-1 font-mono text-[11px] text-[(--muted)]">
            USDC-backed opinions only
          </p>
        </div>
        <BarChart3 className="h-4 w-4 text-[(--muted)]" />
      </div>

      <div className="rounded-[8px] bg-[(--surface-muted)] p-4">
        {!hasOpinions && (
          <p className="mb-4 rounded-[7px] border border-dashed border-[(--border)] bg-[(--surface-solid)] p-3 text-sm text-[(--muted)]">
            No USDC-backed opinions yet.
          </p>
        )}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-[7px] border border-[(--color-brand-secondary)]/25 bg-[(--color-brand-secondary)]/10 p-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[(--color-brand-secondary)]">
              Yes
            </span>
            <p className="mt-1 font-mono text-lg font-black text-[(--foreground)]">
              {yesPercent.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-[7px] border border-[(--color-brand-accent)]/25 bg-[(--color-brand-accent)]/10 p-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[(--color-brand-accent)]">
              No
            </span>
            <p className="mt-1 font-mono text-lg font-black text-[(--foreground)]">
              {noPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="grid gap-3 font-mono text-xs">
          <SentimentRow label="Yes" percent={yesPercent} tone="yes" />
          <SentimentRow label="No" percent={noPercent} tone="no" />
        </div>
      </div>
    </section>
  )
}

function SentimentRow({
  label,
  percent,
  tone,
}: {
  label: string
  percent: number
  tone: 'yes' | 'no'
}) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3">
      <span className="text-[(--foreground)]">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-[(--surface-solid)] ring-1 ring-[(--border)]">
        <span
          className={`block h-full ${tone === 'yes' ? 'bg-[(--color-brand-secondary)]' : 'bg-[(--color-brand-accent)]'}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-right">{percent.toFixed(1)}%</span>
    </div>
  )
}

function RulesPanel({
  noCondition,
  postContent,
  resolutionSource,
  yesCondition,
}: {
  noCondition: string
  postContent: string
  resolutionSource: string
  yesCondition: string
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <h2 className="mb-4 font-black text-[(--foreground)]">Rules</h2>
      <div className="grid gap-3 text-sm leading-relaxed text-[(--foreground)]">
        <p>{postContent}</p>
        <div className="rounded-[8px] border border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/10 p-3">
          <span className="font-mono text-xs font-bold text-[(--color-brand-secondary)]">
            YES
          </span>
          <p className="mt-1">{yesCondition}</p>
        </div>
        <div className="rounded-[8px] border border-[(--color-brand-accent)]/30 bg-[(--color-brand-accent)]/10 p-3">
          <span className="font-mono text-xs font-bold text-[(--color-brand-accent)]">
            NO
          </span>
          <p className="mt-1">{noCondition}</p>
        </div>
        <p className="font-mono text-xs text-[(--muted)]">
          Resolution source: {resolutionSource}
        </p>
      </div>
    </section>
  )
}

function shortHash(hash?: string | null) {
  if (!hash) return ''
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

function CreationReviewPanel({
  market,
  onApprove,
}: {
  market: MarketPost
  onApprove: () => void
}) {
  const creationHash = market.creation_fee_tx_hash || market.creationFeeTxHash
  const feeCollector =
    market.fee_collector_address || market.feeCollectorAddress
  const fee = market.market_creation_fee_usdc ?? 1
  const canApprove = market.status === 'qualified'
  const isTradable = market.status === 'tradable'

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-[(--foreground)]">
            Creation & Review
          </h2>
          <p className="mt-1 text-sm text-[(--muted)]">
            Prediction posts pay an Arc testnet creation fee before entering
            social qualification.
          </p>
        </div>
        <span className="rounded-[7px] border border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/10 px-3 py-1 font-mono text-xs font-bold text-[(--foreground)]">
          {fee} USDC
        </span>
      </div>

      <div className="grid gap-2 font-mono text-xs text-[(--muted)]">
        <div className="flex flex-wrap justify-between gap-3 border-t border-dashed border-[(--border)] pt-3">
          <span>Arc tx</span>
          <span className="text-[(--foreground)]">
            {creationHash ? shortHash(creationHash) : 'Pending'}
          </span>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-dashed border-[(--border)] pt-3">
          <span>Fee collector</span>
          <span className="text-[(--foreground)]">
            {feeCollector ? shortHash(feeCollector) : 'Not recorded'}
          </span>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-dashed border-[(--border)] pt-3">
          <span>System review</span>
          <span className="text-[(--foreground)]">
            {isTradable
              ? 'Approved for USDC trading'
              : canApprove
                ? 'Ready for approval'
                : 'Waiting for qualification'}
          </span>
        </div>
      </div>

      {canApprove && (
        <button
          className="mt-4 h-11 w-full rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85"
          onClick={onApprove}
          type="button"
        >
          Approve for USDC Trading
        </button>
      )}
    </section>
  )
}

function PositionPanel({
  freeVote,
  market,
  onSell,
  positions,
}: {
  freeVote: VoteSide | null
  market: MarketPost
  onSell: (side: VoteSide) => void
  positions: MarketPosition[]
}) {
  const positionRows = positions.map((position) => {
    const currentPrice = getMarketPrice(market, position.side)
    return {
      ...position,
      currentPrice,
      currentValue: position.shares * currentPrice,
      payoutPreview: position.shares,
    }
  })

  return (
    <div className="grid gap-3">
      <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
        <h2 className="font-black text-[(--foreground)]">My Position</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[(--foreground)]">
          Position values are estimates based on the current state of the
          market. They will change as additional trades are placed. You can buy
          and sell until market close.
        </p>

        {!freeVote && positionRows.length === 0 ? (
          <p className="mt-5 border-t border-dashed border-[(--border)] pt-4 text-sm font-medium text-[(--muted)]">
            No position is open on this market.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 border-t border-dashed border-[(--border)] pt-4">
            {freeVote && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] bg-[(--surface-muted)] p-3 font-mono text-xs">
                <span className="text-[(--muted)]">Free opinion</span>
                <span
                  className={
                    freeVote === 'YES'
                      ? 'text-[(--color-brand-secondary)]'
                      : 'text-[(--color-brand-accent)]'
                  }
                >
                  {freeVote}
                </span>
              </div>
            )}

            {positionRows.map((position) => (
              <div className="grid gap-4" key={position.id}>
                <div>
                  <span className="font-mono text-xs text-[(--muted)]">
                    Outcome:
                  </span>
                  <p className="mt-1 text-sm font-semibold text-[(--foreground)]">
                    {position.side === 'YES' ? 'Yes' : 'No'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-[(--muted)]">
                  <span>
                    Cost{' '}
                    <span className="text-[(--foreground)]">
                      ${position.invested_usdc.toFixed(2)}
                    </span>
                  </span>
                  <span>
                    Shares{' '}
                    <span className="text-[(--foreground)]">
                      {position.shares.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </span>
                  <span>
                    Current Value{' '}
                    <span
                      className={
                        position.currentValue >= position.invested_usdc
                          ? 'text-[(--color-brand-secondary)]'
                          : 'text-[(--color-brand-accent)]'
                      }
                    >
                      ${position.currentValue.toFixed(2)}
                    </span>
                    <Info
                      aria-label={`Current price ${(position.currentPrice * 100).toFixed(1)} cents`}
                      className="ml-1 inline h-3 w-3 text-[(--muted)]"
                    />
                  </span>
                  <button
                    className="ml-auto text-[(--foreground)] underline underline-offset-2 hover:text-[(--muted)]"
                    onClick={() => onSell(position.side)}
                    type="button"
                  >
                    Sell
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {positionRows.length > 0 && (
        <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
          <h2 className="font-black text-[(--foreground)]">
            My Payout Preview
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[(--muted)]">
            Preview of potential payouts if the market resolves to your chosen
            outcome side. Payouts are fully secured on-chain.
          </p>

          <div className="mt-5 grid gap-3">
            {positionRows.map((position) => (
              <div
                className="flex items-center justify-between gap-4 font-mono text-sm"
                key={position.id}
              >
                <span className="text-[(--muted)]">
                  {position.side === 'YES' ? 'Yes' : 'No'}
                </span>
                <span
                  className={
                    position.side === 'YES'
                      ? 'text-[(--color-brand-secondary)]'
                      : 'text-[(--color-brand-accent)]'
                  }
                >
                  ${position.payoutPreview.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CommentsPanel({
  commentDraft,
  comments,
  loading,
  onChange,
  onSubmit,
}: {
  commentDraft: string
  comments: MarketComment[]
  loading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-[(--muted)]" />
        <h2 className="font-black text-[(--foreground)]">
          Comments ({comments.length})
        </h2>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-[8px] border border-[(--border)] bg-[(--surface-solid)] px-3 text-sm text-[(--foreground)] outline-none"
          id="market-comment-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add a comment..."
          value={commentDraft}
        />
        <button
          className="h-11 rounded-[8px] bg-[(--inverse)] px-4 font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={loading || !commentDraft.trim()}
          onClick={onSubmit}
          type="button"
        >
          Post
        </button>
      </div>

      <div className="grid gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-[(--muted)]">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article
              className="rounded-[8px] bg-[(--surface-muted)] p-3"
              key={comment.id}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[(--muted)]">
                <span className="font-bold text-[(--foreground)]">
                  {displayName(comment.author)}
                </span>
                <span>{displayHandle(comment.author)}</span>
                <span>{'\u00B7'}</span>
                <span>{relativeTime(comment.created_at)}</span>
              </div>
              <p className="text-sm leading-relaxed text-[(--foreground)]">
                {comment.content}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function MarketStatsPanel({
  closesAt,
  createdAt,
  feeBps,
  liquidity,
  settlesAt,
  volume,
}: {
  closesAt: Date | null
  createdAt: Date | null
  feeBps?: number
  liquidity: number
  settlesAt: Date | null
  volume: number
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm">
      <h2 className="mb-4 font-black text-[(--foreground)]">Market Stats</h2>
      <StatRow label="Trading fee" value={formatTradingFee(feeBps)} />
      <StatRow
        label="Liquidity"
        value={`${liquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
      />
      <StatRow
        label="Volume"
        value={`${volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
      />
      <StatRow
        label="Created"
        value={createdAt ? createdAt.toLocaleString() : 'Unknown'}
      />
      <StatRow
        label="Closes"
        value={closesAt ? closesAt.toLocaleString() : 'Unknown'}
      />
      <StatRow
        label="Settles by"
        value={settlesAt ? settlesAt.toLocaleString() : 'TBD'}
      />
    </section>
  )
}

function CreatorPanel({
  creator,
  creatorName,
  marketsCreated,
  totalVolume,
}: {
  creator: string
  creatorName: string
  marketsCreated: number
  totalVolume: number
}) {
  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[(--color-brand-secondary)]" />
        <h2 className="font-black text-[(--foreground)]">Creator Stats</h2>
      </div>
      <StatRow label="Creator" value={creatorName} />
      <StatRow label="Handle" value={creator} />
      <StatRow
        label="Markets created"
        value={marketsCreated.toLocaleString()}
      />
      <StatRow
        label="Visible volume"
        value={`${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`}
      />
      <p className="mt-3 font-mono text-[11px] text-[(--color-brand-secondary)]">
        Wallet-created market
      </p>
    </section>
  )
}

function SocialActions({
  comments,
  dailyVotesRemaining,
  freeNoVotes,
  freeYesVotes,
  marketStatus,
  onComment,
  onReshare,
  onShare,
  onVote,
  reshares,
  reshared,
  viewerVote,
}: {
  comments: number
  dailyVotesRemaining: number
  freeNoVotes: number
  freeYesVotes: number
  marketStatus: string
  onComment: () => void
  onReshare: () => void
  onShare: () => void
  onVote: (side: VoteSide) => void
  reshares: number
  reshared: boolean
  viewerVote: VoteSide | null
}) {
  const votingDisabled =
    !['open_for_votes', 'qualified'].includes(marketStatus) ||
    Boolean(viewerVote) ||
    dailyVotesRemaining <= 0

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between text-[(--muted)]">
        <IconAction
          icon={<MessageCircle className="h-4 w-4" />}
          label={comments}
          onClick={onComment}
        />
        <IconAction
          active={reshared}
          icon={<Repeat2 className="h-4 w-4" />}
          label={reshares}
          onClick={onReshare}
        />
        <IconAction
          active={viewerVote === 'YES'}
          disabled={votingDisabled}
          icon={<ArrowUp className="h-4 w-4" />}
          label={freeYesVotes}
          onClick={() => onVote('YES')}
        />
        <IconAction
          active={viewerVote === 'NO'}
          disabled={votingDisabled}
          icon={<ArrowDown className="h-4 w-4" />}
          label={freeNoVotes}
          onClick={() => onVote('NO')}
          tone="no"
        />
        <IconAction icon={<Share className="h-4 w-4" />} onClick={onShare} />
      </div>
    </section>
  )
}

function IconAction({
  active = false,
  disabled = false,
  icon,
  label,
  onClick,
  tone = 'yes',
}: {
  active?: boolean
  disabled?: boolean
  icon: ReactNode
  label?: number
  onClick: () => void
  tone?: 'yes' | 'no'
}) {
  return (
    <button
      className={`flex items-center gap-2 transition-colors hover:text-[(--foreground)] ${
        active
          ? tone === 'yes'
            ? 'text-[(--color-brand-secondary)]'
            : 'text-[(--color-brand-accent)]'
          : ''
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="rounded-full p-2 transition-colors hover:bg-[(--surface-hover)]">
        {icon}
      </span>
      {typeof label === 'number' && <span className="text-xs">{label}</span>}
    </button>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-dashed border-[(--border)] py-2 text-sm">
      <span className="text-[(--muted)]">{label}</span>
      <span className="text-right font-mono text-xs font-bold text-[(--foreground)]">
        {value}
      </span>
    </div>
  )
}

function calculateYesPercent(market: MarketPost) {
  const yes = Number(market.usdc_yes_amount)
  const no = Number(market.usdc_no_amount)
  const totalUsdc = yes + no
  if (totalUsdc > 0) return (yes / totalUsdc) * 100

  return 50
}

function VoteQualificationProgressPanel({
  market,
  onDevQualify,
  loading,
}: {
  market: MarketPost
  onDevQualify: () => Promise<void>
  loading: boolean
}) {
  const currentVotes = market.free_yes_votes + market.free_no_votes
  const targetVotes = market.qualificationThreshold ?? 50
  const currentVoters = market.uniqueVotersCount ?? 1
  const targetVoters = market.uniqueVoterThreshold ?? 30

  const votesProgress = Math.min(100, (currentVotes / targetVotes) * 100)
  const votersProgress = Math.min(100, (currentVoters / targetVoters) * 100)

  const isDev = process.env.NODE_ENV !== 'production'

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-black text-[(--foreground)]">
            Social Qualification Progress
          </h2>
          <p className="mt-1 font-mono text-[11px] text-[(--muted)]">
            Markets need community signals to unlock USDC trading
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-[8px] bg-[(--surface-muted)] p-4">
        <div>
          <div className="mb-1 flex justify-between font-mono text-xs text-[(--muted)]">
            <span>Votes cast</span>
            <span className="font-bold text-[(--foreground)]">
              {currentVotes} / {targetVotes}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[(--surface-solid)] ring-1 ring-[(--border)]">
            <div
              className="h-full bg-[(--color-brand-secondary)] transition-all duration-500"
              style={{ width: `${votesProgress}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs text-[(--muted)]">
            <span>Unique voters</span>
            <span className="font-bold text-[(--foreground)]">
              {currentVoters} / {targetVoters}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[(--surface-solid)] ring-1 ring-[(--border)]">
            <div
              className="h-full bg-[(--color-brand-secondary)] transition-all duration-500"
              style={{ width: `${votersProgress}%` }}
            />
          </div>
        </div>
      </div>

      {isDev && (
        <div className="mt-4 border-t border-dashed border-[(--border)] pt-4">
          <p className="mb-2 font-mono text-[10px] text-[(--color-brand-secondary)] uppercase tracking-wider font-bold">
            ⚡ Dev Mode Fast-Track
          </p>
          <button
            className="flex h-11 w-full items-center justify-center rounded-[8px] border border-[(--color-brand-secondary)] bg-[(--color-brand-secondary)]/10 font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--foreground)] transition-colors hover:bg-[(--color-brand-secondary)]/20"
            disabled={loading}
            onClick={onDevQualify}
            type="button"
          >
            {loading ? 'Fast-tracking...' : 'Skip voting & qualify'}
          </button>
        </div>
      )}
    </section>
  )
}

function PreMarketFundingPanel({
  market,
  poolState,
  profileId,
  authorId,
  onFundPreMarket,
  onAddLP,
  actionLoading,
}: {
  market: MarketPost
  poolState: any
  profileId: string | undefined
  authorId: string | undefined
  onFundPreMarket: (amount: number) => Promise<void>
  onAddLP: (amount: number) => Promise<void>
  actionLoading: boolean
}) {
  const currentPoolBalance = poolState?.pool?.currentPoolBalance ?? 0
  const minPoolBalance = 40

  const hasCreatorFunded = Boolean(poolState?.pool)
  const isCurrentUserCreator = Boolean(
    profileId && authorId && profileId === authorId,
  )
  const progress = Math.min(100, (currentPoolBalance / minPoolBalance) * 100)

  const [depositAmount, setDepositAmount] = useState('10')
  const showCreatorEscrow = !hasCreatorFunded

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-[(--foreground)]">
            Pre-Market Escrow Funding
          </h2>
          <p className="mt-1 text-sm text-[(--muted)]">
            A minimum of 40 USDC is required to deploy the active on-chain pool.
          </p>
        </div>
        <span className="rounded-[7px] border border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/10 px-3 py-1 font-mono text-xs font-bold text-[(--foreground)]">
          {currentPoolBalance} / {minPoolBalance} USDC
        </span>
      </div>

      <div className="mb-5 rounded-[8px] bg-[(--surface-muted)] p-4">
        <div className="mb-1 flex justify-between font-mono text-xs text-[(--muted)]">
          <span>Escrowed Balance</span>
          <span className="font-bold text-[(--foreground)]">
            {currentPoolBalance} USDC
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[(--surface-solid)] ring-1 ring-[(--border)]">
          <div
            className="h-full bg-[(--color-brand-secondary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {showCreatorEscrow ? (
          <div className="rounded-[8px] border border-dashed border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/5 p-4 text-center">
            <h3 className="text-sm font-bold text-[(--foreground)]">
              Creator Action Required
            </h3>
            <p className="mt-1 text-xs text-[(--muted)] mb-3">
              The creator must fund the first 10 USDC to initialize the pool and
              activate funding.
            </p>
            {isCurrentUserCreator ? (
              <button
                className="w-full flex h-11 items-center justify-center rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={actionLoading || !profileId}
                onClick={() => onFundPreMarket(10)}
                type="button"
              >
                {actionLoading ? 'Processing Escrow...' : 'Fund 10 USDC Escrow'}
              </button>
            ) : (
              <p className="text-xs text-[(--muted)] italic">
                Waiting for the market creator to make the initial 10 USDC
                deposit...
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-[(--border)] bg-[(--surface-muted)] p-4">
            <h3 className="text-sm font-bold text-[(--foreground)] mb-3">
              Contribute Pre-Market LP
            </h3>
            <div className="flex gap-2">
              <input
                className="h-11 w-24 rounded-[8px] border border-[(--border)] bg-[(--surface-solid)] px-3 font-mono text-sm text-[(--foreground)] outline-none"
                min="1"
                onChange={(e) => setDepositAmount(e.target.value)}
                step="1"
                type="number"
                value={depositAmount}
              />
              <button
                className="flex-1 flex h-11 items-center justify-center rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={
                  actionLoading || !profileId || Number(depositAmount) <= 0
                }
                onClick={() => onAddLP(Number(depositAmount))}
                type="button"
              >
                {actionLoading ? 'Depositing...' : 'Deposit USDC'}
              </button>
            </div>
            <p className="mt-2 font-mono text-[10px] text-[(--muted)] leading-relaxed">
              * Escrowed USDC will be automatically converted to LP shares once
              the pool hits the {minPoolBalance} USDC target.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function ActiveMarketLPPanel({
  lpPositions,
  onAddLP,
  onRemoveLP,
  actionLoading,
  poolState,
  profileId,
}: {
  market: MarketPost
  poolState: any
  lpPositions: any[]
  profileId: string | undefined
  onAddLP: (amount: number) => Promise<void>
  onRemoveLP: (shares: number) => Promise<void>
  actionLoading: boolean
}) {
  const [addAmount, setAddAmount] = useState('10')
  const [removeShares, setRemoveShares] = useState('10')

  const myPosition = lpPositions?.[0]
  const myShares = myPosition?.lpShares ?? 0
  const myDeposited = myPosition?.depositedUsdc ?? 0
  const canRemove = myPosition?.canRemoveLiquidity ?? true

  const totalPoolShares = poolState?.pool?.totalLPShares ?? 0
  const currentPoolBalance = poolState?.pool?.currentPoolBalance ?? 0

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <h2 className="font-black text-[(--foreground)] mb-1">
        Liquidity Provider Management
      </h2>
      <p className="text-sm text-[(--muted)] mb-4">
        Provide USDC liquidity to earn a share of trading fees.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-[8px] bg-[(--surface-muted)] p-3">
          <span className="font-mono text-[10px] uppercase text-[(--muted)] font-black">
            My LP Shares
          </span>
          <p className="mt-1 font-mono text-lg font-black text-[(--foreground)]">
            {Number(myShares).toFixed(4)}
          </p>
        </div>
        <div className="rounded-[8px] bg-[(--surface-muted)] p-3">
          <span className="font-mono text-[10px] uppercase text-[(--muted)] font-black">
            My Value
          </span>
          <p className="mt-1 font-mono text-lg font-black text-[(--foreground)]">
            {Number(myDeposited).toFixed(2)} USDC
          </p>
        </div>
      </div>

      <div className="grid gap-3 font-mono text-xs border-b border-dashed border-[(--border)] pb-4 mb-4">
        <div className="flex justify-between">
          <span className="text-[(--muted)]">Total pool liquidity</span>
          <span className="font-bold text-[(--foreground)]">
            {currentPoolBalance} USDC
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[(--muted)]">Total LP shares</span>
          <span className="font-bold text-[(--foreground)]">
            {Number(totalPoolShares).toFixed(4)}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-[8px] border border-dashed border-[(--border)] bg-[(--surface-solid)] p-4">
          <h3 className="text-xs font-bold text-[(--foreground)] mb-2 uppercase tracking-wide">
            Add Liquidity
          </h3>
          <div className="flex gap-2">
            <input
              className="h-10 w-20 rounded-[8px] border border-[(--border)] bg-[(--surface-muted)] px-3 font-mono text-sm text-[(--foreground)] outline-none"
              min="1"
              onChange={(e) => setAddAmount(e.target.value)}
              step="1"
              type="number"
              value={addAmount}
            />
            <button
              className="flex-1 flex h-10 items-center justify-center rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={actionLoading || !profileId || Number(addAmount) <= 0}
              onClick={() => onAddLP(Number(addAmount))}
              type="button"
            >
              {actionLoading ? 'Adding...' : 'Add LP'}
            </button>
          </div>
        </div>

        <div className="rounded-[8px] border border-dashed border-[(--border)] bg-[(--surface-solid)] p-4">
          <h3 className="text-xs font-bold text-[(--foreground)] mb-2 uppercase tracking-wide">
            Remove Liquidity
          </h3>
          <div className="flex gap-2">
            <input
              className="h-10 w-20 rounded-[8px] border border-[(--border)] bg-[(--surface-muted)] px-3 font-mono text-sm text-[(--foreground)] outline-none"
              max={myShares}
              min="0.0001"
              onChange={(e) => setRemoveShares(e.target.value)}
              step="0.01"
              type="number"
              value={removeShares}
            />
            <button
              className="flex-1 flex h-10 items-center justify-center rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                actionLoading ||
                !profileId ||
                Number(removeShares) <= 0 ||
                Number(removeShares) > myShares ||
                !canRemove
              }
              onClick={() => onRemoveLP(Number(removeShares))}
              type="button"
            >
              {actionLoading ? 'Removing...' : 'Remove'}
            </button>
          </div>
          {!canRemove && (
            <p className="mt-2 text-[10px] text-[(--color-brand-accent)] leading-relaxed">
              * Liquidity is locked for 24 hours after adding to prevent
              front-running.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function ResolutionPanel({
  market,
  onDispute,
  actionLoading,
  profileId,
}: {
  market: MarketPost
  onDispute: () => Promise<void>
  actionLoading: boolean
  profileId: string | undefined
}) {
  const { readProposal, readResolutionBond } = useMarketResolution()
  const [proposal, setProposal] = useState<any>(null)
  const [bond, setBond] = useState<number>(5.0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const p = await readProposal(market.id)
      const b = await readResolutionBond()
      if (!active) return
      setProposal(p)
      setBond(b)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [market.id, readProposal, readResolutionBond])

  useEffect(() => {
    if (
      !proposal ||
      proposal.finalized ||
      proposal.disputed ||
      proposal.proposer === '0x0000000000000000000000000000000000000000'
    ) {
      setTimeLeft(null)
      return
    }
    const windowSecs = Number(
      process.env.NEXT_PUBLIC_DISPUTE_WINDOW_SECONDS || 120,
    )
    const endTime = proposal.proposalTime + windowSecs

    const interval = setInterval(() => {
      const remaining = endTime - Math.floor(Date.now() / 1000)
      if (remaining <= 0) {
        setTimeLeft(0)
        clearInterval(interval)
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [proposal])

  const now = new Date()
  const isPastDeadline = now >= new Date(market.deadline)
  const isResolving = market.status === 'resolving'
  const isResolved = market.status === 'resolved'

  if (!isPastDeadline && !isResolving && !isResolved) return null

  // Quantitative price feed market resolves directly via Pyth update
  const isPyth = Boolean(market.priceFeedId || market.price_feed_id)

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-5 w-5 text-[(--color-brand-secondary)]" />
        <h2 className="font-black text-[(--foreground)]">Market Resolution</h2>
      </div>

      {isPyth ? (
        <div className="rounded-[8px] bg-[(--surface-muted)] p-4 border border-[(--border)]">
          <p className="text-sm text-[(--muted)] leading-relaxed">
            ⚡ <strong>Pyth Quantitative Market:</strong> This prediction
            resolves automatically on-chain using real-time price oracle
            updates. No manual resolution proposal or disputes are needed.
          </p>
        </div>
      ) : (
        <>
          {isPastDeadline && !proposal && !isResolved && (
            <div className="rounded-[8px] bg-[(--surface-muted)] p-4 border border-[(--border)]">
              <p className="text-sm text-[(--muted)] leading-relaxed">
                ⏰ The market trading period has expired. Awaiting AI Agent
                resolution proposal on-chain...
              </p>
            </div>
          )}

          {proposal &&
            !proposal.finalized &&
            !proposal.disputed &&
            proposal.proposer !==
              '0x0000000000000000000000000000000000000000' && (
              <div className="rounded-[8px] bg-[(--surface-muted)] p-4 border border-[(--border)] flex flex-col gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[(--muted)] font-black">
                    Active Proposal
                  </span>
                  <p className="mt-1 text-sm font-bold text-[(--foreground)]">
                    Proposed Outcome:{' '}
                    <span
                      className={
                        proposal.proposedWinningOutcome
                          ? 'text-[(--color-brand-secondary)]'
                          : 'text-[(--color-brand-accent)]'
                      }
                    >
                      {proposal.proposedWinningOutcome ? 'YES' : 'NO'}
                    </span>
                  </p>
                  <p className="text-xs text-[(--muted)] mt-1 font-mono">
                    Proposer: {proposal.proposer.slice(0, 6)}...
                    {proposal.proposer.slice(-4)}
                  </p>
                </div>

                {timeLeft !== null && timeLeft > 0 ? (
                  <div className="rounded-[6px] bg-[(--surface-solid)] p-3 border border-[(--border)]">
                    <span className="font-mono text-[10px] text-[(--muted)] uppercase font-black">
                      Dispute Window Closes In
                    </span>
                    <p className="mt-1 font-mono text-lg font-black text-[(--color-brand-secondary)]">
                      {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
                    </p>
                    <p className="text-[10px] text-[(--muted)] mt-1 leading-relaxed">
                      If you disagree with this outcome, you can dispute it by
                      placing a <strong>{bond} USDC</strong> dispute bond.
                    </p>
                    <button
                      className="mt-3 w-full flex h-10 items-center justify-center rounded-[8px] bg-[(--color-brand-accent)] font-mono text-xs font-black uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={actionLoading || !profileId}
                      onClick={onDispute}
                      type="button"
                    >
                      {actionLoading
                        ? 'Disputing...'
                        : `Dispute Proposal (${bond} USDC)`}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[6px] bg-[(--surface-solid)] p-3 border border-[(--border)]">
                    <span className="font-mono text-[10px] text-[(--muted)] uppercase font-black">
                      Dispute Window Has Closed
                    </span>
                    <p className="text-sm font-medium text-[(--foreground)] mt-1">
                      Awaiting administrative finalization of the proposed
                      outcome on-chain.
                    </p>
                  </div>
                )}
              </div>
            )}

          {proposal && proposal.disputed && !isResolved && (
            <div className="rounded-[8px] bg-[(--color-brand-accent)]/10 border border-[(--color-brand-accent)]/30 p-4">
              <span className="font-mono text-[10px] uppercase text-[(--color-brand-accent)] font-black">
                Disputed
              </span>
              <p className="mt-1 text-sm font-bold text-[(--foreground)]">
                Outcome proposal has been officially disputed!
              </p>
              <p className="text-xs text-[(--muted)] mt-2 font-mono">
                Disputer: {proposal.disputer.slice(0, 6)}...
                {proposal.disputer.slice(-4)}
              </p>
              <p className="text-xs text-[(--muted)] mt-2 leading-relaxed">
                ⚖️ This market is currently escalated to Admin Arbitration. The
                resolution will be determined shortly.
              </p>
            </div>
          )}
        </>
      )}

      {isResolved && (
        <div className="rounded-[8px] bg-[(--color-brand-secondary)]/10 border border-[(--color-brand-secondary)]/30 p-4 flex flex-col gap-3">
          <div>
            <span className="font-mono text-[10px] uppercase text-[(--color-brand-secondary)] font-black">
              Resolved Outcome
            </span>
            <p className="mt-1 text-lg font-black text-[(--foreground)]">
              Resolved to:{' '}
              <span
                className={
                  market.resolvedOutcome === 'YES'
                    ? 'text-[(--color-brand-secondary)]'
                    : 'text-[(--color-brand-accent)]'
                }
              >
                {market.resolvedOutcome}
              </span>
            </p>
            {market.resolvedByAdmin && (
              <p className="text-xs text-[(--muted)] mt-1 font-mono">
                Finalized by: {market.resolvedByAdmin}
              </p>
            )}
          </div>

          {market.proposalReasoning && (
            <div className="rounded-[6px] bg-[(--surface-muted)] p-3 border border-[(--border)] text-xs text-[(--foreground)] leading-relaxed">
              <p className="font-bold mb-1">AI Agent Reasoning:</p>
              <p className="text-[(--muted)] italic">
                {market.proposalReasoning}
              </p>
              {market.proposalCitations &&
                market.proposalCitations.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold mb-1">Sources & Citations:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {market.proposalCitations.map((c, i) => (
                        <li
                          key={i}
                          className="text-[(--muted)] truncate max-w-full"
                        >
                          <a
                            href={c}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline text-[(--accent)] font-mono text-[10px]"
                          >
                            {c}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function RedeemPanel({
  market,
  positions,
  lpPositions,
  onRedeem,
  onClaimCreatorLP,
  actionLoading,
  profileId,
}: {
  market: MarketPost
  positions: MarketPosition[]
  lpPositions: any[]
  onRedeem: () => Promise<void>
  onClaimCreatorLP: () => Promise<void>
  actionLoading: boolean
  profileId: string | undefined
}) {
  const winningSide = market.resolvedOutcome
  const myPosition = positions.find((p) => p.shares > 0)
  const myLPPosition = lpPositions?.find((pos) => pos.isCreator)
  const hasCreatorLP = myLPPosition && myLPPosition.lpShares > 0

  if (!myPosition && !hasCreatorLP) return null

  const isWinner = myPosition && myPosition.side === winningSide
  const winningShares = isWinner ? myPosition.shares : 0

  return (
    <section className="rounded-[12px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <h2 className="font-black text-[(--foreground)] mb-1">Claim Winnings</h2>
      <p className="text-sm text-[(--muted)] mb-4">
        Redeem your winning positions or claim your market creator liquidity
        payouts.
      </p>

      {myPosition && (
        <div className="rounded-[8px] bg-[(--surface-muted)] p-4 border border-[(--border)] mb-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-mono text-[10px] uppercase text-[(--muted)] font-black">
                My Outcome Position
              </span>
              <p className="mt-1 font-mono text-sm font-bold text-[(--foreground)]">
                {myPosition.shares.toFixed(2)} {myPosition.side} Shares
              </p>
            </div>
            <div>
              {isWinner ? (
                <span className="inline-flex items-center rounded-full bg-[(--color-brand-secondary)]/10 px-2 py-1 text-xs font-medium text-[(--color-brand-secondary)]">
                  Winner
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[(--border)] px-2 py-1 text-xs font-medium text-[(--muted)]">
                  Losing Outcome
                </span>
              )}
            </div>
          </div>

          {isWinner && (
            <div className="mt-4">
              <div className="flex justify-between font-mono text-xs mb-3 text-[(--foreground)]">
                <span>Redeemable Value</span>
                <span className="font-bold text-[(--color-brand-secondary)]">
                  {winningShares.toFixed(2)} USDC
                </span>
              </div>
              <button
                className="w-full flex h-10 items-center justify-center rounded-[8px] bg-[(--color-brand-secondary)] font-mono text-xs font-black uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={actionLoading || !profileId}
                onClick={onRedeem}
                type="button"
              >
                {actionLoading ? 'Redeeming...' : 'Redeem Winnings'}
              </button>
            </div>
          )}
        </div>
      )}

      {hasCreatorLP && (
        <div className="rounded-[8px] bg-[(--surface-muted)] p-4 border border-[(--border)]">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-[(--muted)] font-black">
                Locked Creator Liquidity
              </span>
              <p className="mt-1 font-mono text-sm font-bold text-[(--foreground)]">
                {myLPPosition.lpShares.toFixed(4)} LP Shares
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[(--accent)]/10 px-2 py-1 text-xs font-medium text-[(--accent)]">
              Creator LP
            </span>
          </div>
          <p className="text-xs text-[(--muted)] mb-3 leading-relaxed">
            As the market creator, your 10 USDC initial liquidity escrow can now
            be claimed and disbursed according to the final pool ratios.
          </p>
          <button
            className="w-full flex h-10 items-center justify-center rounded-[8px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={actionLoading || !profileId}
            onClick={onClaimCreatorLP}
            type="button"
          >
            {actionLoading ? 'Claiming...' : 'Claim Creator LP'}
          </button>
        </div>
      )}
    </section>
  )
}
