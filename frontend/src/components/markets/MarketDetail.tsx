"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@/lib/toast"

import VerityAgentPanel from "@/components/markets/VerityAgentPanel"
import CommentModal from "@/components/social/CommentModal"
import { useDailyVotes } from "@/hooks/useDailyVotes"
import { useFeed } from "@/hooks/useFeed"
import { useSetRightPanelSlot } from "@/hooks/useRightPanelSlot"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { useAuth } from "@/components/providers/AuthModals"
import { useSocket } from "@/hooks/useSocket"

import {
  displayHandle,
  displayName,
  getMarketPrice,
  relativeTime,
  calculateTradingFee,
  calculateGrossUsdc,
  FeedPost,
  MarketComment,
  MarketTradeAction,
  MarketPost,
  VoteSide,
} from "@/lib/verity"

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
  useMarketDetailQuery,
} from "@/store/verity/verityQueries"

import { useMarketLiquidity } from "@/hooks/useMarketLiquidity"
import { useMarketResolution } from "@/hooks/useMarketResolution"
import { formatWeb3Error } from "@/lib/arc"

// Extracted subcomponents
import MarketHero from "./detail/MarketHero"
import OutcomesPanel from "./detail/OutcomesPanel"
import TradeTicket from "./detail/TradeTicket"
import SentimentPanel from "./detail/SentimentPanel"
import PositionPanel from "./detail/PositionPanel"
import CommentsPanel from "./detail/CommentsPanel"
import PreMarketFundingPanel from "./detail/PreMarketFundingPanel"
import ActiveMarketLPPanel from "./detail/ActiveMarketLPPanel"
import ResolutionPanel from "./detail/ResolutionPanel"
import { RedeemPanel, RefundPanel } from "./detail/RedeemPanel"
import {
  RulesPanel,
  MarketStatsPanel,
  CreatorPanel,
  SocialActions,
} from "./detail/MarketMetadata"
import MyHoldingsPanel from "./detail/MyHoldingsPanel"

interface MarketDetailProps {
  marketId: string
}

export default function MarketDetail({ marketId }: MarketDetailProps) {
  const { user } = useAuth()
  const profile = user
  const queryClient = useQueryClient()
  const balance = useUsdcBalance()
  const { joinRoom, leaveRoom } = useSocket()

  const profileId = profile?.id
  const isConnected = Boolean(profileId)

  const searchParams = useSearchParams()
  const querySide = searchParams.get("side") as VoteSide | null
  const queryAction = searchParams.get("action") as MarketTradeAction | null

  // State declarations
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState("")
  const [commentLoading, setCommentLoading] = useState(false)
  const [tradeAmount, setTradeAmount] = useState("1")
  const [tradeAction, setTradeAction] = useState<MarketTradeAction>(
    queryAction || "BUY",
  )
  const [selectedSide, setSelectedSide] = useState<VoteSide>(querySide || "YES")
  const [replyingToComment, setReplyingToComment] =
    useState<MarketComment | null>(null)
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)

  const { dailyVotes, refetch: reloadDailyVotes } = useDailyVotes(profileId)
  const { items, loading: feedLoading } = useFeed(undefined, true)
  const {
    data: item,
    isLoading: itemLoading,
    error: itemError,
    refetch: refetchMarket,
  } = useMarketDetailQuery(marketId, profileId || undefined)

  const market = item?.market || null
  const postId = item?.id
  const detailMarketId = market?.id

  // Auto-select child market matching the route marketId, otherwise default to first child
  useEffect(() => {
    if (
      market?.marketType === "parent" &&
      market.childMarkets &&
      market.childMarkets.length > 0 &&
      !selectedChildId
    ) {
      const matchingChild = market.childMarkets.find(
        (child) => child.id === marketId,
      )
      if (matchingChild) {
        setSelectedChildId(matchingChild.id)
      } else {
        setSelectedChildId(market.childMarkets[0].id)
      }
    }
  }, [market, selectedChildId, marketId])

  // Synchronize browser URL path with the selected option
  useEffect(() => {
    if (selectedChildId && selectedChildId !== marketId) {
      const newUrl = `/markets/${selectedChildId}`
      window.history.replaceState(null, "", newUrl)
    }
  }, [selectedChildId, marketId])

  const activeMarketId = selectedChildId || detailMarketId

  const activeOption = useMemo(() => {
    if (market?.marketType === "parent" && market.childMarkets) {
      return market.childMarkets.find((child) => child.id === selectedChildId)
    }
    return null
  }, [market, selectedChildId])

  const activeOptionName = activeOption
    ? activeOption.optionName || activeOption.question
    : null

  const activeMarket = useMemo(() => {
    return activeOption || market
  }, [activeOption, market]) as MarketPost

  useEffect(() => {
    if (activeMarketId) {
      joinRoom(`market:${activeMarketId}`)
      if (postId) {
        joinRoom(`post:${postId}`)
      }
      return () => {
        leaveRoom(`market:${activeMarketId}`)
        if (postId) {
          leaveRoom(`post:${postId}`)
        }
      }
    }
  }, [activeMarketId, postId, joinRoom, leaveRoom])

  // Set default side for multi-outcome markets
  useEffect(() => {
    if (
      activeMarket &&
      activeMarket.outcomeCount &&
      activeMarket.outcomeCount > 2
    ) {
      const outcomes = activeMarket.outcomes || []
      if (outcomes.length > 0 && !outcomes.includes(selectedSide)) {
        setSelectedSide(outcomes[0])
      }
    }
  }, [activeMarket, selectedSide])

  // Queries
  const { data: poolStateData } = usePoolStateQuery(activeMarketId || "")
  const { data: lpPositionsData } = useLPPositionsQuery(
    activeMarketId || "",
    profileId || "",
  )
  const { data: fetchedTrades } = useMarketTradesQuery(activeMarketId || "")
  const { data: fetchedComments } = usePostCommentsQuery(postId || "")
  const { data: fetchedPositions } = useMarketPositionsQuery(
    activeMarketId || "",
    profileId || "",
  )

  // Mutations
  const { mutateAsync: addComment } = useAddCommentMutation()
  const { mutateAsync: approveMarketForTrading } =
    useApproveMarketForTradingMutation()
  const { mutateAsync: castFreeVote } = useCastFreeVoteMutation()
  const { mutateAsync: toggleReshare } = useToggleReshareMutation()
  const { mutateAsync: devQualifyMarket } = useDevQualifyMutation()

  // Liquidity and Resolution hooks
  const {
    fundPreMarket,
    addPoolLiquidity,
    removePoolLiquidity,
    buyTokens,
    sellTokens,
  } = useMarketLiquidity()
  const { disputeResolution, redeemWinnings, claimCreatorLP, claimRefund } =
    useMarketResolution()

  // Derived Values
  const poolYesPrice = poolStateData?.prices?.yesPrice
  const poolNoPrice = poolStateData?.prices?.noPrice

  const yesPercent = useMemo(() => {
    if (poolYesPrice != null) return poolYesPrice * 100
    return activeMarket ? getMarketPrice(activeMarket, "YES") * 100 : 50
  }, [poolYesPrice, activeMarket])

  const noPercent = useMemo(() => {
    if (poolNoPrice != null) return poolNoPrice * 100
    return 100 - yesPercent
  }, [poolNoPrice, yesPercent])

  const totalUsdc = useMemo(() => {
    if ((poolStateData?.pool?.currentPoolBalance ?? 0) > 0) {
      return poolStateData.pool.currentPoolBalance
    }
    return activeMarket
      ? Number(activeMarket.usdc_yes_amount) +
          Number(activeMarket.usdc_no_amount)
      : 0
  }, [poolStateData, activeMarket])

  const hasUsdcOpinion = totalUsdc > 0

  const tradeAmountNumber = Number(tradeAmount)
  const validTradeAmount =
    Number.isFinite(tradeAmountNumber) && tradeAmountNumber > 0
  const selectedPrice = activeMarket
    ? getMarketPrice(activeMarket, selectedSide)
    : 0.5
  const buyShares = validTradeAmount ? tradeAmountNumber / selectedPrice : 0
  const sellProceeds = validTradeAmount ? tradeAmountNumber * selectedPrice : 0
  const tradeBaseAmount =
    tradeAction === "BUY" ? tradeAmountNumber : sellProceeds
  const tradeFee =
    activeMarket && validTradeAmount
      ? calculateTradingFee(tradeBaseAmount, activeMarket.trading_fee_bps)
      : 0
  const tradeTotal =
    activeMarket && validTradeAmount
      ? tradeAction === "BUY"
        ? calculateGrossUsdc(tradeAmountNumber, activeMarket.trading_fee_bps)
        : Math.max(0, sellProceeds - tradeFee)
      : 0

  const isBalanceInsufficient = useMemo(() => {
    if (!user || tradeAction !== "BUY" || !validTradeAmount) return false
    const rawRequired = BigInt(Math.round(tradeTotal * 1e6))
    return balance.rawBalance < rawRequired
  }, [user, tradeAction, validTradeAmount, tradeTotal, balance.rawBalance])

  const leadingSide: VoteSide = yesPercent >= noPercent ? "YES" : "NO"
  const leadingPercent = Math.max(yesPercent, noPercent)

  const createdAt = useMemo(
    () => (activeMarket ? new Date(activeMarket.created_at) : null),
    [activeMarket],
  )
  const closesAt = useMemo(
    () => (activeMarket ? new Date(activeMarket.deadline) : null),
    [activeMarket],
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

  // Transactions execution handler helper
  const runAction = useCallback(
    async (actionType: string, action: () => Promise<unknown>) => {
      if (!profileId) {
        toast.error("Connect your wallet first.")
        return
      }

      setActionPending(actionType)

      try {
        await action()
        await Promise.all([
          refetchMarket(),
          reloadDailyVotes(),
          queryClient.invalidateQueries({
            queryKey: ["pool-state", detailMarketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["lp-positions", detailMarketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["positions", detailMarketId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["trades", detailMarketId],
          }),
          ...(activeMarketId && activeMarketId !== detailMarketId
            ? [
                queryClient.invalidateQueries({
                  queryKey: ["pool-state", activeMarketId],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["lp-positions", activeMarketId],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["positions", activeMarketId],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["trades", activeMarketId],
                }),
              ]
            : []),
        ])
      } catch (caught) {
        toast.error(formatWeb3Error(caught))
      } finally {
        setActionPending(null)
      }
    },
    [
      profileId,
      refetchMarket,
      reloadDailyVotes,
      queryClient,
      detailMarketId,
      activeMarketId,
    ],
  )

  const handleDispute = useCallback(async () => {
    if (!activeMarket || !profileId) return
    await runAction("dispute", async () => {
      await disputeResolution(activeMarket.id)
    })
  }, [activeMarket, profileId, disputeResolution, runAction])

  const handleRedeem = useCallback(
    async (claimAmount?: number) => {
      if (!activeMarket || !profileId) return
      await runAction("redeem", async () => {
        await redeemWinnings(activeMarket.id, claimAmount)
        await balance.refetch()
      })
    },
    [activeMarket, profileId, redeemWinnings, runAction, balance],
  )

  const handleClaimCreatorLP = useCallback(
    async (claimAmount?: number) => {
      if (!activeMarket || !profileId) return
      await runAction("claim_creator_lp", async () => {
        await claimCreatorLP(activeMarket.id, claimAmount)
      })
    },
    [activeMarket, profileId, claimCreatorLP, runAction],
  )

  const handleClaimRefund = useCallback(
    async (claimAmount?: number) => {
      if (!activeMarket || !profileId) return
      await runAction("claim_refund", async () => {
        await claimRefund(activeMarket.id, claimAmount)
      })
    },
    [activeMarket, profileId, claimRefund, runAction],
  )

  const handleDevQualify = useCallback(async () => {
    if (!market) return
    await runAction("dev_qualify", async () => {
      await devQualifyMarket(market.id)
    })
  }, [market, devQualifyMarket, runAction])

  const handleFundPreMarket = useCallback(
    async (amount: number) => {
      if (!activeMarketId || !profileId) return
      await runAction("fund_pre_market", async () => {
        await fundPreMarket(activeMarketId, profileId, amount, true)
      })
    },
    [activeMarketId, profileId, fundPreMarket, runAction],
  )

  const handleAddLP = useCallback(
    async (amount: number) => {
      if (!activeMarketId || !profileId) return
      await runAction("add_lp", async () => {
        const isPoolActive = poolStateData?.pool?.status === "active"
        if (!isPoolActive) {
          await fundPreMarket(activeMarketId, profileId, amount, false)
        } else {
          await addPoolLiquidity(activeMarketId, profileId, amount)
        }
      })
    },
    [
      activeMarketId,
      profileId,
      poolStateData,
      fundPreMarket,
      addPoolLiquidity,
      runAction,
    ],
  )

  const handleRemoveLP = useCallback(
    async (shares: number) => {
      if (!activeMarketId || !profileId) return
      await runAction("remove_lp", async () => {
        await removePoolLiquidity(activeMarketId, profileId, shares)
      })
    },
    [activeMarketId, profileId, removePoolLiquidity, runAction],
  )

  async function sharePost(post: FeedPost) {
    const text = post.market?.question || post.content
    const url = `${window.location.origin}/markets/${marketId}`

    if (navigator.share) {
      await navigator.share({ title: "Verity", text, url })
      return
    }

    await navigator.clipboard.writeText(`${text}\n${url}`)
    toast.success("Link copied to clipboard!")
  }

  const executeTrade = useCallback(
    async (side: VoteSide) => {
      if (!activeMarket || !profileId) return

      if (tradeAction === "BUY" && isBalanceInsufficient) {
        toast.error(`Insufficient USDC balance`)
        return
      }

      await runAction("trade", async () => {
        const amount = Number(tradeAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("Enter a valid USDC amount.")
        }
        const isMulti =
          activeMarket.outcomeCount !== undefined &&
          activeMarket.outcomeCount > 2
        const outcomeIndex = isMulti
          ? (activeMarket.outcomes?.indexOf(side) ?? -1)
          : -1
        const isYesOrIndex = isMulti ? outcomeIndex : side === "YES"

        if (tradeAction === "BUY") {
          await buyTokens(
            activeMarket.id,
            profileId,
            isYesOrIndex,
            tradeAmountNumber,
            tradeFee,
            buyShares,
            isMulti ? side : undefined,
          )
        } else {
          await sellTokens(
            activeMarket.id,
            profileId,
            isYesOrIndex,
            amount,
            tradeTotal,
            tradeFee,
            isMulti ? side : undefined,
          )
        }
      })
    },
    [
      activeMarket,
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
      isBalanceInsufficient,
      balance.formattedBalance,
    ],
  )

  async function submitComment() {
    if (!item || !market || !commentDraft.trim()) return
    if (!profile) {
      toast.error("Connect your wallet before commenting.")
      return
    }

    setCommentLoading(true)
    try {
      await addComment({
        postId: item.id,
        authorId: profile.id,
        content: commentDraft,
      })
      setCommentDraft("")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Comment failed.")
    } finally {
      setCommentLoading(false)
    }
  }

  // Sidebar elements definition
  const sidebarPanels = useMemo(() => {
    if (!market || !postId) return null

    const creatorHandle = item ? displayHandle(item.author) : ""
    const creatorName = item ? displayName(item.author) : ""

    return (
      <>
        <MyHoldingsPanel
          positions={positions}
          activeMarket={activeMarket}
          viewerVote={item.viewerVote}
          onQuickSell={(side) => {
            setTradeAction("SELL")
            setSelectedSide(side)
          }}
        />

        {["open_for_votes", "qualified", "funding_pool"].includes(
          activeMarket.status,
        ) ? (
          <PreMarketFundingPanel
            actionLoading={actionPending}
            authorId={item.author_id || item.authorId}
            market={activeMarket}
            onAddLP={handleAddLP}
            onFundPreMarket={handleFundPreMarket}
            poolState={poolStateData}
            profileId={profileId}
            activeOptionName={activeOptionName}
          />
        ) : (
          <TradeTicket
            action={tradeAction}
            amount={tradeAmount}
            balanceLabel={balance.isLoading ? "..." : balance.formattedBalance}
            isBalanceInsufficient={isBalanceInsufficient}
            disabled={
              Boolean(actionPending) ||
              activeMarket.status !== "tradable" ||
              !validTradeAmount
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
            actionPending={actionPending === "trade"}
            maxSellShares={selectedSideShares}
            yesCondition={
              activeMarket?.yes_condition || activeMarket?.yesCondition || "Yes"
            }
            noCondition={
              activeMarket?.no_condition || activeMarket?.noCondition || "No"
            }
            outcomeCount={activeMarket?.outcomeCount}
            outcomes={activeMarket?.outcomes}
            outcomePrices={activeMarket?.outcomePrices}
          />
        )}

        <MarketStatsPanel
          createdAt={createdAt}
          feeBps={activeMarket.trading_fee_bps}
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
    activeMarket,
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
    actionPending,
    handleAddLP,
    handleFundPreMarket,
    poolStateData,
    profileId,
    activeOptionName,
  ])

  const rightPanelSlot = useMemo(
    () =>
      sidebarPanels ? (
        <div className="flex flex-col gap-3">{sidebarPanels}</div>
      ) : null,
    [sidebarPanels],
  )
  useSetRightPanelSlot(rightPanelSlot)

  // Loading skeleton state
  if (itemLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse mt-4">
        <div className="verity-card p-5 h-36 bg-stone-surface/30 rounded-xl" />
        <div className="verity-card p-5 h-48 bg-stone-surface/30 rounded-xl" />
      </div>
    )
  }

  if (itemError) {
    return (
      <div className="rounded-[12px] bg-ember-orange/10 p-4 text-sm font-medium tracking-[-0.18px] text-charcoal-primary shadow-subtle">
        {(itemError as any).message || "Failed to load market."}
      </div>
    )
  }

  if (!item || !market) {
    return (
      <div className="verity-card p-8 text-center text-sm font-medium tracking-[-0.18px] text-ash">
        Market not found.{" "}
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
        onDevQualify={handleDevQualify}
        devQualifyLoading={actionPending === "dev_qualify"}
      />

      {market.marketType === "parent" && market.childMarkets && (
        <OutcomesPanel
          childMarkets={market.childMarkets}
          selectedChildId={selectedChildId}
          selectedSide={selectedSide}
          marketStatus={market.status}
          onSelectOptionAndSide={(childId, side) => {
            setSelectedChildId(childId)
            setSelectedSide(side)
            setTradeAction("BUY")
          }}
        />
      )}

      {/* Mobile Right Sidebar Slots */}
      <div className="flex flex-col gap-3 lg:hidden">{sidebarPanels}</div>

      <SocialActions
        comments={item.commentsCount}
        freeNoVotes={market.free_no_votes}
        freeYesVotes={market.free_yes_votes}
        dailyVotesRemaining={dailyVotes?.votesRemaining ?? 0}
        marketStatus={activeMarket.status}
        onComment={() =>
          document.getElementById("market-comment-input")?.focus()
        }
        onReshare={() =>
          runAction("reshare", () =>
            toggleReshare({
              postId: item.id,
              profileId: profile!.id,
              currentlyReshared: item.viewerReshared,
            }),
          )
        }
        onShare={() => sharePost(item)}
        onVote={(side) =>
          runAction("free_vote", () =>
            castFreeVote({
              marketId: market.id,
              userId: profile!.id,
              side,
            }),
          )
        }
        reshares={item.resharesCount}
        reshared={item.viewerReshared}
        viewerVote={item.viewerVote}
      />

      <CommentsPanel
        commentDraft={commentDraft}
        comments={comments}
        loading={commentLoading}
        onChange={setCommentDraft}
        onSubmit={submitComment}
        onReplyClick={setReplyingToComment}
      />

      {activeMarket.status === "tradable" && (
        <ActiveMarketLPPanel
          actionLoading={actionPending}
          lpPositions={lpPositionsData || []}
          market={activeMarket}
          onAddLP={handleAddLP}
          onRemoveLP={handleRemoveLP}
          poolState={poolStateData}
          profileId={profileId}
        />
      )}

      {(activeMarket.status === "resolving" ||
        activeMarket.status === "resolved" ||
        isPastDeadline) && (
        <ResolutionPanel
          market={activeMarket}
          onDispute={handleDispute}
          actionLoading={actionPending}
          profileId={profileId}
        />
      )}

      {activeMarket.status === "resolved" && (
        <RedeemPanel
          market={activeMarket}
          positions={positions}
          lpPositions={lpPositionsData || []}
          onRedeem={handleRedeem}
          onClaimCreatorLP={handleClaimCreatorLP}
          actionLoading={actionPending}
          profileId={profileId}
        />
      )}

      {activeMarket.status === "voided" && (
        <RefundPanel
          market={activeMarket}
          lpPositions={lpPositionsData || []}
          onClaimRefund={handleClaimRefund}
          actionLoading={actionPending}
          profileId={profileId}
        />
      )}

      <RulesPanel
        noCondition={market.no_condition || "No"}
        postContent={item.content}
        resolutionSource={market.resolution_source}
        yesCondition={market.yes_condition || "Yes"}
      />

      <VerityAgentPanel market={market} />

      <PositionPanel
        freeVote={item.viewerVote}
        market={market}
        onSell={(side) => {
          setSelectedSide(side)
          setTradeAction("SELL")
        }}
        positions={positions}
      />

      <CommentModal
        replyToComment={replyingToComment}
        isOpen={Boolean(replyingToComment)}
        onClose={() => setReplyingToComment(null)}
      />
    </div>
  )
}
