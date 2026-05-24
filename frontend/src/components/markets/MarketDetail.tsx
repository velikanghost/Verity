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
  const [actionPending, setActionPending] = useState<string | null>(null)
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
  const { disputeResolution, redeemWinnings, claimCreatorLP, claimRefund } =
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
  const selectedSideShares = useMemo(
    () =>
      positions
        .filter((position) => position.side === selectedSide)
        .reduce((sum, position) => sum + Number(position.shares || 0), 0),
    [positions, selectedSide],
  )

  const volume = useMemo(() => {
    return trades.reduce((sum, t) => sum + Number(t.amount_usdc || 0), 0)
  }, [trades])

  const liveLiquidity = useMemo(() => {
    return (
      poolStateData?.pool?.currentPoolBalance ?? market?.liquidity ?? totalUsdc
    )
  }, [poolStateData, market, totalUsdc])

  const runAction = useCallback(
    async (actionType: string, action: () => Promise<unknown>) => {
      if (!profileId) {
        toast.error('Connect your wallet first.')
        return
      }

      setActionPending(actionType)

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
        setActionPending(null)
      }
    },
    [profileId, reload, reloadDailyVotes, queryClient, detailMarketId],
  )

  const handleDispute = useCallback(async () => {
    if (!market || !profileId) return
    await runAction('dispute', async () => {
      await disputeResolution(market.id)
    })
  }, [market, profileId, disputeResolution, runAction])

  const handleRedeem = useCallback(async () => {
    if (!market || !profileId) return
    await runAction('redeem', async () => {
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
    await runAction('claim_creator_lp', async () => {
      await claimCreatorLP(market.id)
    })
  }, [market, profileId, claimCreatorLP, runAction])

  const handleClaimRefund = useCallback(async () => {
    if (!market || !profileId) return
    await runAction('claim_refund', async () => {
      await claimRefund(market.id)
    })
  }, [market, profileId, claimRefund, runAction])

  const approveTrading = useCallback(async () => {
    if (!market) return
    await runAction('approve_trading', () => approveMarketForTrading(market.id))
  }, [market, runAction, approveMarketForTrading])

  const handleDevQualify = useCallback(async () => {
    if (!market) return
    await runAction('dev_qualify', async () => {
      await devQualifyMarket(market.id)
    })
  }, [market, devQualifyMarket, runAction])

  const handleFundPreMarket = useCallback(
    async (amount: number) => {
      if (!market || !profileId) return
      await runAction('fund_pre_market', async () => {
        await fundPreMarket(market.id, profileId, amount, true)
      })
    },
    [market, profileId, fundPreMarket, runAction],
  )

  const handleAddLP = useCallback(
    async (amount: number) => {
      if (!market || !profileId) return
      await runAction('add_lp', async () => {
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
      await runAction('remove_lp', async () => {
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

      await runAction('trade', async () => {
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
        {(item.viewerVote || positions.length > 0) && (
          <div className="verity-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-dashed border-stone-surface pb-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
                My Holdings
              </span>
              {item.viewerVote && (
                <span className="font-mono text-[10px] text-ash">
                  Signal:{' '}
                  <span
                    className={
                      item.viewerVote === 'YES'
                        ? 'font-semibold text-meadow-green'
                        : 'font-semibold text-ember-orange'
                    }
                  >
                    {item.viewerVote === 'YES' ? 'Upvote' : 'Downvote'}
                  </span>
                </span>
              )}
            </div>

            {positions.length === 0 ? (
              <p className="text-xs text-ash">
                No cash positions in this market.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {positions.map((pos) => {
                  const isResolved = market.status === 'resolved'
                  const isWinner = isResolved && market.resolvedOutcome === pos.side
                  const currentPrice = isResolved
                    ? (isWinner ? 1.0 : 0.0)
                    : getMarketPrice(market, pos.side)
                  const currentValue = pos.shares * currentPrice
                  const isProfit = currentValue >= pos.invested_usdc
                  const pnl = currentValue - pos.invested_usdc
                  const pnlPercent =
                    pos.invested_usdc > 0 ? (pnl / pos.invested_usdc) * 100 : 0

                  return (
                    <div
                      key={pos.id}
                      className="rounded-[12px] bg-parchment-card p-3 shadow-[var(--shadow-subtle)]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        {isResolved ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold ${
                              isWinner
                                ? 'bg-meadow-green/10 text-meadow-green shadow-[var(--shadow-subtle)]'
                                : 'bg-stone-surface text-ash'
                            }`}
                          >
                            {isWinner ? 'WINNING' : 'LOST'} {pos.side} POSITION
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold shadow-[var(--shadow-subtle)] ${
                              pos.side === 'YES'
                                ? 'bg-meadow-green/10 text-meadow-green'
                                : 'bg-ember-orange/10 text-ember-orange'
                            }`}
                          >
                            {pos.side} POSITION
                          </span>
                        )}

                        {!isResolved && (
                          <button
                            className="font-mono text-[10px] font-semibold text-ember-orange underline underline-offset-2 hover:text-charcoal-primary"
                            onClick={() => {
                              setTradeAction('SELL')
                              setSelectedSide(pos.side)
                            }}
                            type="button"
                          >
                            Quick Sell
                          </button>
                        )}
                      </div>

                      <div className="mt-1.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="block text-[9px] uppercase text-ash">
                            Shares
                          </span>
                          <span className="font-semibold text-charcoal-primary">
                            {pos.shares.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-ash">
                            Avg Price
                          </span>
                          <span className="font-semibold text-charcoal-primary">
                            {pos.avg_price.toFixed(2)} USDC
                          </span>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase text-ash">
                            Value
                          </span>
                          <span
                            className={
                              isProfit
                                ? 'font-semibold text-meadow-green'
                                : 'font-semibold text-ember-orange'
                            }
                          >
                            ${currentValue.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-stone-surface pt-2 font-mono text-[10px]">
                        <span className="text-ash">Return:</span>
                        <span
                          className={
                            isProfit
                              ? 'font-semibold text-meadow-green'
                              : 'font-semibold text-ember-orange'
                          }
                        >
                          {isProfit ? '+' : ''}
                          {pnl.toFixed(2)} USDC ({isProfit ? '+' : ''}
                          {pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <TradeTicket
          action={tradeAction}
          amount={tradeAmount}
          balanceLabel={balance.isLoading ? '...' : balance.formattedBalance}
          disabled={
            Boolean(actionPending) || market.status !== 'tradable' || !validTradeAmount
          }
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
          actionPending={actionPending === 'trade'}
          maxSellShares={selectedSideShares}
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
    positions,
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
    JSON.stringify(positions),
  ].join('|')

  useSetRightPanelSlot(rightPanelSlot, rightPanelSlotKey)

  if (loading) {
    return (
      <div className="verity-card p-8 text-center text-sm font-medium tracking-[-0.18px] text-ash">
        Loading market...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[12px] bg-ember-orange/10 p-4 text-sm font-medium tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)]">
        {error}
      </div>
    )
  }

  if (!item || !market) {
    return (
      <div className="verity-card p-8 text-center text-sm font-medium tracking-[-0.18px] text-ash">
        Market not found.{' '}
        <Link className="font-semibold text-ember-orange underline" href="/">
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

      {['open_for_votes', 'qualified', 'funding_pool', 'tradable'].includes(
        market.status,
      ) && (
        <VoteQualificationProgressPanel
          loading={actionPending === 'dev_qualify'}
          market={market}
          onDevQualify={handleDevQualify}
        />
      )}

      {['open_for_votes', 'qualified', 'funding_pool'].includes(
        market.status,
      ) && (
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

      {market.status === 'voided' && (
        <RefundPanel
          market={market}
          lpPositions={lpPositionsData || []}
          onClaimRefund={handleClaimRefund}
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
          runAction('reshare', () =>
            toggleReshare({
              postId: item.id,
              profileId: profile!.id,
              currentlyReshared: item.viewerReshared,
            }),
          )
        }
        onShare={() => sharePost(item)}
        onVote={(side) =>
          runAction('free_vote', () =>
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
    <section className="verity-card relative overflow-hidden p-4 sm:p-5">
      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-sunburst-yellow/30" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="relative min-w-0">
          <h1 className="text-[23px] font-semibold leading-[1.12] tracking-[-0.44px] text-midnight sm:text-[32px]">
            {question}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-ash">
            <span className="rounded-[6px] bg-parchment-card px-2.5 py-1 text-graphite shadow-[var(--shadow-subtle)]">
              {category}
            </span>
            <span>by {creator}</span>
            <span>{'\u00B7'}</span>
            <span>{time}</span>
          </div>
        </div>
        <span
          className={`verity-pill relative px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${market.status === 'voided' ? 'bg-stone-surface text-ash' : 'bg-meadow-green/12 text-meadow-green'}`}
        >
          {market.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-stone-surface pt-3 font-mono text-xs text-ash">
        <span>
          Leading outcome:{' '}
          <strong
            className={
              leadingSide === 'YES'
                ? 'text-meadow-green'
                : 'text-ember-orange'
            }
          >
            {leadingSide} {leadingPercent.toFixed(1)}%
          </strong>
        </span>
        <span>{totalVotes} Upvote/Downvote signals</span>
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
  actionPending = false,
  maxSellShares,
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
  actionPending?: boolean
  maxSellShares: number
}) {
  const quickBuyAmounts = [1, 5, 10, 100]
  const sellPercentages = [25, 50, 75, 100]
  const amountNumber = Number(amount)
  const previewValue =
    Number.isFinite(amountNumber) && amountNumber > 0 ? amountNumber : 0

  function addBuyAmount(value: number) {
    const nextAmount = Number.isFinite(amountNumber) ? amountNumber + value : value
    onAmountChange(String(nextAmount))
  }

  function setSellPercentage(percent: number) {
    const shares = (maxSellShares * percent) / 100
    onAmountChange(shares > 0 ? shares.toFixed(4) : '0')
  }

  return (
    <section className="verity-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-stone-surface px-4 py-3">
        <div className="flex gap-4">
        {(['BUY', 'SELL'] as const).map((nextAction) => (
          <button
            aria-pressed={action === nextAction}
            className={`relative h-8 text-sm font-semibold tracking-[-0.18px] transition-colors ${
              action === nextAction ? 'text-charcoal-primary' : 'text-ash hover:text-charcoal-primary'
            }`}
            key={nextAction}
            onClick={() => onActionChange(nextAction)}
            type="button"
          >
            {nextAction === 'BUY' ? 'Buy' : 'Sell'}
            {action === nextAction && (
              <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-charcoal-primary" />
            )}
          </button>
        ))}
        </div>
        <span className="font-mono text-[11px] font-semibold text-charcoal-primary">
          Market
        </span>
      </div>

      <div className="p-4">

      <div className="mb-6 grid grid-cols-2 gap-3">
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

        <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <label
            className="block text-[15px] font-semibold tracking-[-0.2px] text-charcoal-primary"
            htmlFor="market-trade-amount"
          >
            {action === 'BUY' ? 'Amount' : 'Shares'}
          </label>
          <p className="mt-0.5 font-mono text-[11px] text-ash">
            {action === 'BUY'
              ? `${balanceLabel} USDC balance`
              : `${maxSellShares.toFixed(4)} ${selectedSide} available`}
          </p>
        </div>
        <input
          aria-label={action === 'BUY' ? 'USDC amount' : 'Shares to sell'}
            className="h-14 w-28 bg-transparent text-right font-mono text-[30px] font-semibold leading-none tracking-[-0.7px] text-midnight outline-none placeholder:text-ash sm:w-32 sm:text-[34px] sm:tracking-[-1px]"
          id="market-trade-amount"
          min="0"
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="0"
          step="0.01"
          type="number"
          value={amount}
        />
      </div>

      {action === 'BUY' ? (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          {quickBuyAmounts.map((value) => (
            <button
              className="verity-pill h-8 bg-parchment-card px-3 font-mono text-xs font-semibold text-graphite shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
              key={value}
              onClick={() => addBuyAmount(value)}
              type="button"
            >
              +${value}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          {sellPercentages.map((percent) => (
            <button
              className="verity-pill h-8 bg-parchment-card px-3 font-mono text-xs font-semibold text-graphite shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface disabled:cursor-not-allowed disabled:opacity-45"
              disabled={maxSellShares <= 0}
              key={percent}
              onClick={() => setSellPercentage(percent)}
              type="button"
            >
              {percent === 100 ? 'Max' : `${percent}%`}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-1 rounded-[12px] bg-parchment-card p-3 font-mono text-[11px] text-ash shadow-[var(--shadow-subtle)]">
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
        <div className="flex justify-between text-charcoal-primary">
          <span>{action === 'BUY' ? 'Total' : 'Net proceeds'}</span>
          <span>
            {previewValue > 0
              ? action === 'BUY'
                ? total.toFixed(4)
                : netProceeds.toFixed(4)
              : '0.0000'}{' '}
            USDC
          </span>
        </div>
      </div>

      <button
        className="verity-pill mt-4 flex h-11 w-full items-center justify-center bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled || !isConnected}
        onClick={onTrade}
        type="button"
      >
        {actionPending
          ? 'Processing...'
          : isConnected
            ? `${action === 'BUY' ? 'Buy' : 'Sell'} ${selectedSide}`
            : 'Connect Wallet'}
      </button>
      </div>
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
      className={`rounded-[12px] px-3 py-3 text-center shadow-[var(--shadow-subtle)] transition-colors ${
        active
          ? side === 'YES'
            ? 'bg-meadow-green/12'
            : 'bg-ember-orange/10'
          : 'bg-parchment-card hover:bg-stone-surface'
      }`}
      onClick={() => onClick(side)}
      type="button"
    >
      <span
        className={`block text-sm font-semibold ${
          active
            ? side === 'YES'
              ? 'text-meadow-green'
              : 'text-ember-orange'
            : 'text-charcoal-primary'
        }`}
      >
        {label}
      </span>
      <span className="font-mono text-[11px] text-ash">
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
    <section className="verity-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold tracking-[-0.18px] text-charcoal-primary">Market Sentiment</h2>
          <p className="mt-1 font-mono text-[11px] text-ash">
            USDC-backed opinions only
          </p>
        </div>
        <BarChart3 className="h-4 w-4 text-ash" />
      </div>

      <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
        {!hasOpinions && (
          <p className="mb-4 rounded-[10px] bg-white-surface p-3 text-sm text-ash shadow-[var(--shadow-subtle)]">
            No USDC-backed opinions yet.
          </p>
        )}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-[10px] bg-meadow-green/10 p-3 shadow-[var(--shadow-subtle)]">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-meadow-green">
              Yes
            </span>
            <p className="mt-1 font-mono text-lg font-semibold text-charcoal-primary">
              {yesPercent.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-[10px] bg-ember-orange/10 p-3 shadow-[var(--shadow-subtle)]">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ember-orange">
              No
            </span>
            <p className="mt-1 font-mono text-lg font-semibold text-charcoal-primary">
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
      <span className="text-charcoal-primary">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-white-surface shadow-[var(--shadow-subtle)]">
        <span
          className={`block h-full ${tone === 'yes' ? 'bg-meadow-green' : 'bg-ember-orange'}`}
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
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-4 font-semibold tracking-[-0.18px] text-charcoal-primary">Rules</h2>
      <div className="grid gap-3 text-sm leading-relaxed tracking-[-0.18px] text-graphite">
        <p>{postContent}</p>
        <div className="rounded-[10px] bg-meadow-green/10 p-3 shadow-[var(--shadow-subtle)]">
          <span className="font-mono text-xs font-semibold text-meadow-green">
            YES
          </span>
          <p className="mt-1">{yesCondition}</p>
        </div>
        <div className="rounded-[10px] bg-ember-orange/10 p-3 shadow-[var(--shadow-subtle)]">
          <span className="font-mono text-xs font-semibold text-ember-orange">
            NO
          </span>
          <p className="mt-1">{noCondition}</p>
        </div>
        <p className="font-mono text-xs text-ash">
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
      {positionRows.length > 0 && (
        <section className="verity-card p-4 sm:p-5">
          <h2 className="font-semibold tracking-[-0.18px] text-charcoal-primary">My Payout Preview</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed tracking-[-0.18px] text-graphite">
            Preview of potential payouts if the market resolves to your chosen
            outcome side. Payouts are fully secured on-chain.
          </p>

          <div className="mt-5 grid gap-3">
            {positionRows.map((position) => (
              <div
                className="flex items-center justify-between gap-4 font-mono text-sm"
                key={position.id}
              >
                <span className="text-ash">
                  {position.side === 'YES' ? 'Yes' : 'No'}
                </span>
                <span
                  className={
                    position.side === 'YES'
                      ? 'text-meadow-green'
                      : 'text-ember-orange'
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
    <section className="verity-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-ash" />
        <h2 className="font-semibold tracking-[-0.18px] text-charcoal-primary">
          Comments ({comments.length})
        </h2>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
          id="market-comment-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add a comment..."
          value={commentDraft}
        />
        <button
          className="verity-pill h-11 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={loading || !commentDraft.trim()}
          onClick={onSubmit}
          type="button"
        >
          Post
        </button>
      </div>

      <div className="grid gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-ash">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article
              className="rounded-[10px] bg-parchment-card p-3 shadow-[var(--shadow-subtle)]"
              key={comment.id}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-ash">
                <span className="font-semibold text-charcoal-primary">
                  {displayName(comment.author)}
                </span>
                <span>{displayHandle(comment.author)}</span>
                <span>{'\u00B7'}</span>
                <span>{relativeTime(comment.created_at)}</span>
              </div>
              <p className="text-sm leading-relaxed tracking-[-0.18px] text-graphite">
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
    <section className="verity-card p-4">
      <h2 className="mb-4 font-semibold tracking-[-0.18px] text-charcoal-primary">Market Stats</h2>
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
    <section className="verity-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-meadow-green" />
        <h2 className="font-semibold tracking-[-0.18px] text-charcoal-primary">Creator Stats</h2>
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
      <p className="mt-3 font-mono text-[11px] text-meadow-green">
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
    !['open_for_votes', 'qualified', 'funding_pool', 'tradable'].includes(
      marketStatus,
    ) ||
    Boolean(viewerVote) ||
    dailyVotesRemaining <= 0

  return (
    <section className="verity-card p-4">
      <div className="flex items-center justify-between text-ash">
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
      className={`flex items-center gap-2 transition-colors hover:text-charcoal-primary ${
        active
          ? tone === 'yes'
            ? 'text-meadow-green'
            : 'text-ember-orange'
          : ''
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="rounded-full p-2 transition-colors hover:bg-stone-surface">
        {icon}
      </span>
      {typeof label === 'number' && <span className="text-xs">{label}</span>}
    </button>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-dashed border-stone-surface py-2 text-sm">
      <span className="text-ash">{label}</span>
      <span className="text-right font-mono text-xs font-semibold text-charcoal-primary">
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

  const isDev = process.env.NEXT_PUBLIC_NODE_ENV !== 'production'

  return (
    <section className="verity-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
            Social Signal Progress
          </h2>
          <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
            Markets need Upvote/Downvote signals to unlock USDC trading
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
        <div>
          <div className="mb-1 flex justify-between font-mono text-xs text-ash">
            <span>Signals cast</span>
            <span className="font-semibold text-charcoal-primary">
              {currentVotes} / {targetVotes}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white-surface shadow-[var(--shadow-subtle)]">
            <div
              className="h-full bg-meadow-green transition-all duration-500"
              style={{ width: `${votesProgress}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs text-ash">
            <span>Unique signalers</span>
            <span className="font-semibold text-charcoal-primary">
              {currentVoters} / {targetVoters}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white-surface shadow-[var(--shadow-subtle)]">
            <div
              className="h-full bg-sky-blue transition-all duration-500"
              style={{ width: `${votersProgress}%` }}
            />
          </div>
        </div>
      </div>

      {isDev && (
        <div className="mt-4 border-t border-dashed border-stone-surface pt-4">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-meadow-green">
            Dev Mode Fast-Track
          </p>
          <button
            className="verity-pill flex h-11 w-full items-center justify-center bg-meadow-green/10 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-meadow-green/20"
            disabled={loading}
            onClick={onDevQualify}
            type="button"
          >
            {loading ? 'Fast-tracking...' : 'Skip signal review'}
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
  actionLoading: string | null
}) {
  const currentPoolBalance = poolState?.pool?.currentPoolBalance ?? 0
  const minPoolBalance = 40

  const hasCreatorFunded = Boolean(poolState?.pool)
  const isCurrentUserCreator = Boolean(
    profileId && authorId && profileId === authorId,
  )
  const progress = Math.min(100, (currentPoolBalance / minPoolBalance) * 100)

  const [depositAmount, setDepositAmount] = useState('10')
  const showCreatorEscrow = false

  return (
    <section className="verity-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
            Pool Funding
          </h2>
          <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
            Fund this market's launch pool. Contributions help open trading and may earn liquidity rewards.
          </p>
        </div>
        <span className="rounded-full bg-meadow-green/10 px-3 py-1 font-mono text-xs font-semibold text-charcoal-primary shadow-[var(--shadow-subtle)]">
          {currentPoolBalance} / {minPoolBalance} USDC
        </span>
      </div>

      <div className="mb-5 rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
        <div className="mb-1 flex justify-between font-mono text-xs text-ash">
          <span>Pool Funding</span>
          <span className="font-semibold text-charcoal-primary">
            {currentPoolBalance} USDC
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white-surface shadow-[var(--shadow-subtle)]">
          <div
            className="h-full bg-meadow-green transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {showCreatorEscrow ? (
          <div className="rounded-[12px] bg-meadow-green/10 p-4 text-center shadow-[var(--shadow-subtle)]">
            <h3 className="text-sm font-semibold text-charcoal-primary">
              Creator Action Required
            </h3>
            <p className="mb-3 mt-1 text-xs text-ash">
              The creator must fund the first 10 USDC to initialize the pool and
              activate funding.
            </p>
            {isCurrentUserCreator ? (
              <button
                className="verity-pill flex h-11 w-full items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={Boolean(actionLoading) || !profileId}
                onClick={() => onFundPreMarket(10)}
                type="button"
              >
                {actionLoading === 'fund_pre_market' ? 'Funding...' : 'Fund 10 USDC'}
              </button>
            ) : null}
          </div>
        ) : currentPoolBalance >= minPoolBalance ? (
          <div className="flex flex-col items-center justify-center rounded-[12px] bg-parchment-card py-6 text-center shadow-[var(--shadow-subtle)]">
            <svg
              className="mb-3 h-8 w-8 animate-spin text-meadow-green"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="font-mono text-sm font-semibold text-charcoal-primary">
              All conditions met
            </span>
            <span className="mt-1 text-xs text-ash">
              Deploying market on-chain...
            </span>
          </div>
        ) : (
          <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
            <h3 className="mb-3 text-sm font-semibold text-charcoal-primary">
              Fund the Launch Pool
            </h3>
            <div className="flex gap-2">
              <input
                className="h-11 w-24 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none focus:ring-2 focus:ring-stone-surface"
                min="1"
                onChange={(e) => setDepositAmount(e.target.value)}
                step="1"
                type="number"
                value={depositAmount}
              />
              <button
                className="verity-pill flex h-11 flex-1 items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={
                  Boolean(actionLoading) || !profileId || Number(depositAmount) <= 0
                }
                onClick={() => onAddLP(Number(depositAmount))}
                type="button"
              >
                {actionLoading === 'add_lp' ? 'Funding...' : 'Fund'}
              </button>
            </div>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-ash">
              Contributions convert to LP shares once the pool hits the {minPoolBalance} USDC launch target.
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
  actionLoading: string | null
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
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-1 text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
        Liquidity Provider Management
      </h2>
      <p className="mb-4 text-sm tracking-[-0.18px] text-ash">
        Provide USDC liquidity to earn a share of trading fees.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-[12px] bg-parchment-card p-3 shadow-[var(--shadow-subtle)]">
          <span className="font-mono text-[10px] font-semibold uppercase text-ash">
            My LP Shares
          </span>
          <p className="mt-1 font-mono text-lg font-semibold text-charcoal-primary">
            {Number(myShares).toFixed(4)}
          </p>
        </div>
        <div className="rounded-[12px] bg-parchment-card p-3 shadow-[var(--shadow-subtle)]">
          <span className="font-mono text-[10px] font-semibold uppercase text-ash">
            My Value
          </span>
          <p className="mt-1 font-mono text-lg font-semibold text-charcoal-primary">
            {Number(myDeposited).toFixed(2)} USDC
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 border-b border-dashed border-stone-surface pb-4 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-ash">Total pool liquidity</span>
          <span className="font-semibold text-charcoal-primary">
            {currentPoolBalance} USDC
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ash">Total LP shares</span>
          <span className="font-semibold text-charcoal-primary">
            {Number(totalPoolShares).toFixed(4)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-primary">
            Add Liquidity
          </h3>
          <div className="flex gap-2">
            <input
              className="h-10 w-20 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none focus:ring-2 focus:ring-stone-surface"
              min="1"
              onChange={(e) => setAddAmount(e.target.value)}
              step="1"
              type="number"
              value={addAmount}
            />
            <button
              className="verity-pill flex h-10 flex-1 items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={Boolean(actionLoading) || !profileId || Number(addAmount) <= 0}
              onClick={() => onAddLP(Number(addAmount))}
              type="button"
            >
              {actionLoading === 'add_lp' ? 'Adding...' : 'Add LP'}
            </button>
          </div>
        </div>

        <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-primary">
            Remove Liquidity
          </h3>
          <div className="flex gap-2">
            <input
              className="h-10 w-20 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none focus:ring-2 focus:ring-stone-surface"
              max={myShares}
              min="0.0001"
              onChange={(e) => setRemoveShares(e.target.value)}
              step="0.01"
              type="number"
              value={removeShares}
            />
            <button
              className="verity-pill flex h-10 flex-1 items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                Boolean(actionLoading) ||
                !profileId ||
                Number(removeShares) <= 0 ||
                Number(removeShares) > myShares ||
                !canRemove
              }
              onClick={() => onRemoveLP(Number(removeShares))}
              type="button"
            >
              {actionLoading === 'remove_lp' ? 'Removing...' : 'Remove'}
            </button>
          </div>
          {!canRemove && (
            <p className="mt-2 text-[10px] leading-relaxed text-ember-orange">
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
  actionLoading: string | null
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
    <section className="verity-card p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-meadow-green/10">
          <ShieldCheck className="h-5 w-5 text-meadow-green" />
        </span>
        <h2 className="text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
          Market Resolution
        </h2>
      </div>

      {isPyth ? (
        <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
          <p className="text-sm leading-relaxed tracking-[-0.18px] text-ash">
            <strong>Pyth Quantitative Market:</strong> This prediction
            resolves automatically on-chain using real-time price oracle
            updates. No manual resolution proposal or disputes are needed.
          </p>
        </div>
      ) : (
        <>
          {isPastDeadline && !proposal && !isResolved && (
            <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
              <p className="text-sm leading-relaxed tracking-[-0.18px] text-ash">
                The market trading period has expired. Awaiting AI Agent
                resolution proposal on-chain...
              </p>
            </div>
          )}

          {proposal &&
            !proposal.finalized &&
            !proposal.disputed &&
            proposal.proposer !==
              '0x0000000000000000000000000000000000000000' && (
              <div className="flex flex-col gap-3 rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                    Active Proposal
                  </span>
                  <p className="mt-1 text-sm font-semibold text-charcoal-primary">
                    Proposed Outcome:{' '}
                    <span
                      className={
                        proposal.proposedWinningOutcome
                          ? 'text-meadow-green'
                          : 'text-ember-orange'
                      }
                    >
                      {proposal.proposedWinningOutcome ? 'YES' : 'NO'}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-ash">
                    Proposer: {proposal.proposer.slice(0, 6)}...
                    {proposal.proposer.slice(-4)}
                  </p>
                </div>

                {timeLeft !== null && timeLeft > 0 ? (
                  <div className="rounded-[10px] bg-white-surface p-3 shadow-[var(--shadow-subtle)]">
                    <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                      Dispute Window Closes In
                    </span>
                    <p className="mt-1 font-mono text-lg font-semibold text-meadow-green">
                      {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-ash">
                      If you disagree with this outcome, you can dispute it by
                      placing a <strong>{bond} USDC</strong> dispute bond.
                    </p>
                    <button
                      className="verity-pill mt-3 flex h-10 w-full items-center justify-center bg-ember-orange font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={Boolean(actionLoading) || !profileId}
                      onClick={onDispute}
                      type="button"
                    >
                      {actionLoading === 'dispute'
                        ? 'Disputing...'
                        : `Dispute Proposal (${bond} USDC)`}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[10px] bg-white-surface p-3 shadow-[var(--shadow-subtle)]">
                    <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                      Dispute Window Has Closed
                    </span>
                    <p className="mt-1 text-sm font-medium tracking-[-0.18px] text-charcoal-primary">
                      Awaiting administrative finalization of the proposed
                      outcome on-chain.
                    </p>
                  </div>
                )}
              </div>
            )}

          {proposal && proposal.disputed && !isResolved && (
            <div className="rounded-[12px] bg-ember-orange/10 p-4 shadow-[var(--shadow-subtle)]">
              <span className="font-mono text-[10px] font-semibold uppercase text-ember-orange">
                Disputed
              </span>
              <p className="mt-1 text-sm font-semibold text-charcoal-primary">
                Outcome proposal has been officially disputed!
              </p>
              <p className="mt-2 font-mono text-xs text-ash">
                Disputer: {proposal.disputer.slice(0, 6)}...
                {proposal.disputer.slice(-4)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ash">
                This market is currently escalated to Admin Arbitration. The
                resolution will be determined shortly.
              </p>
            </div>
          )}
        </>
      )}

      {isResolved && (
        <div className="flex flex-col gap-3 rounded-[12px] bg-meadow-green/10 p-4 shadow-[var(--shadow-subtle)]">
          <div>
            <span className="font-mono text-[10px] font-semibold uppercase text-meadow-green">
              Resolved Outcome
            </span>
            <p className="mt-1 text-lg font-semibold tracking-[-0.25px] text-charcoal-primary">
              Resolved to:{' '}
              <span
                className={
                  market.resolvedOutcome === 'YES'
                    ? 'text-meadow-green'
                    : 'text-ember-orange'
                }
              >
                {market.resolvedOutcome}
              </span>
            </p>
            {market.resolvedByAdmin && (
              <p className="mt-1 font-mono text-xs text-ash">
                Finalized by: {market.resolvedByAdmin}
              </p>
            )}
          </div>

          {market.proposalReasoning && (
            <div className="rounded-[10px] bg-white-surface p-3 text-xs leading-relaxed text-charcoal-primary shadow-[var(--shadow-subtle)]">
              <p className="mb-1 font-semibold">AI Agent Reasoning:</p>
              <p className="italic text-ash">{market.proposalReasoning}</p>
              {market.proposalCitations &&
                market.proposalCitations.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 font-semibold">Sources & Citations:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {market.proposalCitations.map((c, i) => (
                        <li key={i} className="max-w-full truncate text-ash">
                          <a
                            href={c}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] text-ember-orange hover:underline"
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
  actionLoading: string | null
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
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-1 text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
        Claim Winnings
      </h2>
      <p className="mb-4 text-sm tracking-[-0.18px] text-ash">
        Redeem your winning positions or claim your market creator liquidity
        payouts.
      </p>

      {myPosition && (
        <div className="mb-4 rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                My Outcome Position
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-charcoal-primary">
                {myPosition.shares.toFixed(2)} {myPosition.side} Shares
              </p>
            </div>
            <div>
              {isWinner ? (
                <span className="inline-flex items-center rounded-full bg-meadow-green/10 px-2 py-1 text-xs font-medium text-meadow-green shadow-[var(--shadow-subtle)]">
                  Winner
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-stone-surface px-2 py-1 text-xs font-medium text-ash">
                  Losing Outcome
                </span>
              )}
            </div>
          </div>

          {isWinner && (
            <div className="mt-4">
              <div className="mb-3 flex justify-between font-mono text-xs text-charcoal-primary">
                <span>Redeemable Value</span>
                <span className="font-semibold text-meadow-green">
                  {winningShares.toFixed(2)} USDC
                </span>
              </div>
              <button
                className="verity-pill flex h-10 w-full items-center justify-center bg-meadow-green font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={Boolean(actionLoading) || !profileId}
                onClick={onRedeem}
                type="button"
              >
                {actionLoading === 'redeem' ? 'Redeeming...' : 'Redeem Winnings'}
              </button>
            </div>
          )}
        </div>
      )}

      {hasCreatorLP && (
        <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                Locked Creator Liquidity
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-charcoal-primary">
                {myLPPosition.lpShares.toFixed(4)} LP Shares
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-sky-blue/10 px-2 py-1 text-xs font-medium text-sky-blue shadow-[var(--shadow-subtle)]">
              Creator LP
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-ash">
            As the market creator, your initial launch liquidity can now be
            claimed and disbursed according to the final pool ratios.
          </p>
          <button
            className="verity-pill flex h-10 w-full items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={Boolean(actionLoading) || !profileId}
            onClick={onClaimCreatorLP}
            type="button"
          >
            {actionLoading === 'claim_creator_lp' ? 'Claiming...' : 'Claim Creator LP'}
          </button>
        </div>
      )}
    </section>
  )
}

function RefundPanel({
  market,
  lpPositions,
  onClaimRefund,
  actionLoading,
  profileId,
}: {
  market: MarketPost
  lpPositions: any[]
  onClaimRefund: () => Promise<void>
  actionLoading: string | null
  profileId: string | undefined
}) {
  const myLPPosition = lpPositions?.find((pos) => pos.userId === profileId)
  const hasDeposited = myLPPosition && myLPPosition.lpShares > 0

  if (!hasDeposited) return null

  return (
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-1 text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
        Claim Refund
      </h2>
      <p className="mb-4 text-sm tracking-[-0.18px] text-ash">
        This market was voided. You can retrieve your committed pool funding.
      </p>

      <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] font-semibold uppercase text-ash">
              Your Pool Funding
            </span>
            <p className="mt-1 font-mono text-sm font-semibold text-charcoal-primary">
              {myLPPosition.lpShares.toFixed(2)} USDC
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-meadow-green/10 px-2 py-1 text-xs font-medium text-meadow-green shadow-[var(--shadow-subtle)]">
            Voided Market Refund
          </span>
        </div>
        <button
          className="verity-pill flex h-10 w-full items-center justify-center bg-meadow-green font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={Boolean(actionLoading) || !profileId}
          onClick={onClaimRefund}
          type="button"
        >
          {actionLoading === 'claim_refund' ? 'Claiming Refund...' : 'Claim USDC Refund'}
        </button>
      </div>
    </section>
  )
}
