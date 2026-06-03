"use client"

import { useState, useEffect, useMemo } from "react"
import { useFeed } from "@/hooks/useFeed"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useAuth } from "@/components/providers/AuthModals"
import { useMarketLiquidity } from "@/hooks/useMarketLiquidity"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { arcUsdcAddress, FPMM_ADDRESS, publicClient } from "@/lib/arc"
import {
  useActivePvpEventsQuery,
  usePvpStatusQuery,
  useSubmitPvpTicketMutation,
  useReferralsQuery,
  usePvpMatchHistoryQuery,
  useCastFreeVoteMutation,
  useExecuteMarketTradeMutation,
  useUserPortfolioQuery,
} from "@/store/verity/verityQueries"
import {
  TrendingUp,
  Swords,
  Zap,
  Search,
  Share2,
  Copy,
  Check,
  Award,
  Timer,
  ChevronRight,
  ShieldCheck,
  Bot,
  User,
  Users,
  X,
  Coins,
} from "lucide-react"
import Link from "next/link"
import { toast } from "react-hot-toast"
import { calculateYesPercent, displayHandle, displayName } from "@/lib/verity"

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "")
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`
}

function getPhaseTag(status: string) {
  switch (status) {
    case "open_for_votes":
      return {
        label: "Voting",
        color:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      }
    case "qualified":
      return {
        label: "Qualified",
        color:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      }
    case "funding_pool":
      return {
        label: "Funding",
        color:
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      }
    case "tradable":
      return {
        label: "Trading",
        color:
          "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      }
    case "resolved":
      return {
        label: "Resolved",
        color:
          "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
      }
    default:
      return {
        label: status.replace("_", " "),
        color:
          "bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20",
      }
  }
}

type MarketsTab = "general" | "pvp-arena"

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState<MarketsTab>("general")
  const { profile } = useWalletProfile()
  const { user, executeTxBatch } = useAuth()
  const { addPoolLiquidity } = useMarketLiquidity()
  const { rawBalance } = useUsdcBalance()
  const { mutateAsync: executeMarketTrade } = useExecuteMarketTradeMutation()

  // New states for ticket purchases & liquidity deposits
  const [betAmountPerSelection, setBetAmountPerSelection] = useState<number>(5)
  const [liquidityMarketId, setLiquidityMarketId] = useState<string | null>(
    null,
  )
  const [liquidityAmount, setLiquidityAmount] = useState<string>("10")
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false)

  // Standard feed markets (excludes pvp)
  const {
    items: feedItems,
    loading: feedLoading,
    reload: reloadFeed,
  } = useFeed(profile?.id, true)

  // PvP API queries
  const { data: pvpEvents = [], isLoading: pvpEventsLoading } =
    useActivePvpEventsQuery()
  const { data: pvpStatus, refetch: refetchPvpStatus } = usePvpStatusQuery()
  const { data: referralsData, refetch: refetchReferrals } = useReferralsQuery()
  const { data: matchHistory = [] } = usePvpMatchHistoryQuery()
  const { data: userPositions = [] } = useUserPortfolioQuery(profile?.id || "")

  const runningScoreUser = useMemo(() => {
    if (!pvpStatus?.ticket?.picks) return 0
    const correct = pvpStatus.ticket.picks.filter(
      (p: any) => p.isCorrect === true,
    ).length
    const resolved = pvpStatus.ticket.picks.filter(
      (p: any) => p.isCorrect !== null,
    ).length
    if (resolved === 0) return 0
    const wrong = resolved - correct
    let score = correct * 70 + wrong * 30
    if (correct === 7) score += 100
    return score
  }, [pvpStatus])

  const runningScoreOpponent = useMemo(() => {
    if (!pvpStatus?.opponent?.picks) return 0
    const correct = pvpStatus.opponent.picks.filter(
      (p: any) => p.isCorrect === true,
    ).length
    const resolved = pvpStatus.opponent.picks.filter(
      (p: any) => p.isCorrect !== null,
    ).length
    if (resolved === 0) return 0
    const wrong = resolved - correct
    let score = correct * 70 + wrong * 30
    if (correct === 7) score += 100
    return score
  }, [pvpStatus])

  const submitTicketMutation = useSubmitPvpTicketMutation()
  const castFreeVoteMutation = useCastFreeVoteMutation()

  // State for search and category filtering
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // State for active PvP event selection in ticket builder
  const [selectedPvpEventId, setSelectedPvpEventId] = useState<string | null>(
    null,
  )
  const [pvpSelections, setPvpSelections] = useState<
    Record<string, "YES" | "NO">
  >({})

  // Copy state for referral code
  const [copiedCode, setCopiedCode] = useState(false)

  // Active PvP event computed
  const selectedPvpEvent = useMemo(() => {
    if (!pvpEvents || pvpEvents.length === 0) return null
    if (selectedPvpEventId) {
      return (
        pvpEvents.find((e: any) => e.id === selectedPvpEventId) || pvpEvents[0]
      )
    }
    return pvpEvents[0]
  }, [pvpEvents, selectedPvpEventId])

  // Teams for active ticket builder
  const builderTeams = useMemo(() => {
    if (!selectedPvpEvent?.question) return null
    const match = selectedPvpEvent.question.match(/(.+?)\s+vs\.?\s+(.+)/i)
    if (match) {
      return {
        teamA: match[1].trim(),
        teamB: match[2].trim(),
      }
    }
    return null
  }, [selectedPvpEvent])

  // Teams for active match screen
  const activeDuelTeams = useMemo(() => {
    if (!pvpStatus?.event?.question) return null
    const match = pvpStatus.event.question.match(/(.+?)\s+vs\.?\s+(.+)/i)
    if (match) {
      return {
        teamA: match[1].trim(),
        teamB: match[2].trim(),
      }
    }
    return null
  }, [pvpStatus])

  // Get current option child market details for LP modal
  const optionForLP = useMemo(() => {
    if (!liquidityMarketId || !selectedPvpEvent) return null
    return selectedPvpEvent.options.find((o: any) => o.id === liquidityMarketId)
  }, [liquidityMarketId, selectedPvpEvent])

  // Reset selections when event changes
  useEffect(() => {
    if (selectedPvpEvent) {
      setSelectedPvpEventId(selectedPvpEvent.id)
      const initial: Record<string, "YES" | "NO"> = {}
      selectedPvpEvent.options.forEach((opt: any) => {
        initial[opt.id] = "YES" // Default to YES
      })
      setPvpSelections(initial)
    }
  }, [selectedPvpEvent])

  // Poll PvP matchmaking queue status if user is queued
  useEffect(() => {
    let interval: NodeJS.Timeout
    const isQueued = pvpStatus?.status === "queued"

    if (isQueued) {
      interval = setInterval(() => {
        refetchPvpStatus()
      }, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [pvpStatus, refetchPvpStatus])

  // Filtered standard markets
  const filteredMarkets = useMemo(() => {
    if (!feedItems) return []
    return feedItems.filter((item) => {
      if (item.type !== "market" || !item.market) return false

      // Exclude resolved and voided markets
      if (
        item.market.status === "resolved" ||
        item.market.status === "voided"
      ) {
        return false
      }

      const matchesSearch = item.market.question
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesCategory =
        !selectedCategory || item.market.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [feedItems, searchQuery, selectedCategory])

  // Handle Free vote casting
  async function handleFreeVote(marketId: string, side: "YES" | "NO") {
    if (!profile) {
      toast.error("Connect your wallet to cast a vote.")
      return
    }
    try {
      await castFreeVoteMutation.mutateAsync({
        marketId,
        userId: profile.id,
        side,
      })
      toast.success(`Casted your ${side} signal!`)
      void reloadFeed()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit signal.")
    }
  }

  // Submit PvP selections ticket (batching 7 on-chain prediction buy calls + optional approval)
  async function handleSubmitPvpTicket() {
    if (!profile || !user?.walletAddress) {
      toast.error("Connect your wallet to queue for the Arena.")
      return
    }
    if (!selectedPvpEvent) return

    const picks = Object.keys(pvpSelections).map((marketId) => ({
      marketId,
      selection: pvpSelections[marketId],
    }))

    if (picks.length !== 7) {
      toast.error("Please make a selection for all 7 options.")
      return
    }

    const totalAmount = betAmountPerSelection * 7
    const rawTotalAmount = BigInt(Math.round(totalAmount * 1e6))

    const toastId = toast.loading("Preparing ticket transaction batch...")
    try {
      // 1. Check current USDC allowance to FPMM_ADDRESS
      const allowance = await publicClient.readContract({
        abi: [
          {
            name: "allowance",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
            ],
            outputs: [{ name: "", type: "uint256" }],
          },
        ] as const,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      const batchCalls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // If allowance is too low, add a single approval call for the entire batch ticket cost
      if (allowance < rawTotalAmount) {
        batchCalls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, rawTotalAmount],
        })
      }

      // 2. Build 7 buy calls for each child market prediction selection
      const rawAmountPerSelection = BigInt(
        Math.round(betAmountPerSelection * 1e6),
      )
      selectedPvpEvent.options.forEach((opt: any) => {
        const side = pvpSelections[opt.id] // "YES" or "NO"
        const isYes = side === "YES"
        batchCalls.push({
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "buy(bytes32,bool,uint256)",
          abiParameters: [formatMarketId(opt.id), isYes, rawAmountPerSelection],
        })
      })

      toast.dismiss(toastId)

      // 3. Execute batched on-chain buy calls
      const hash = await executeTxBatch(
        batchCalls,
        `Purchase 7-selection PvP ticket for ${totalAmount} USDC`,
        totalAmount,
      )

      // 4. Register all 7 trades on backend in parallel
      const finalizeToastId = toast.loading(
        "Finalizing on-chain trades on Verity...",
      )
      const tradePromises = Object.keys(pvpSelections).map((marketId) => {
        const side = pvpSelections[marketId]
        return executeMarketTrade({
          marketId,
          profileId: profile.id,
          side,
          action: "BUY",
          amount: betAmountPerSelection,
          txHash: hash,
        })
      })
      await Promise.all(tradePromises)
      toast.dismiss(finalizeToastId)

      // 5. Submit the ticket to the PvP Arena matchmaking queue
      const queueToastId = toast.loading("Queueing for PvP match...")
      await submitTicketMutation.mutateAsync({
        parentMarketId: selectedPvpEvent.id,
        picks,
      })
      toast.dismiss(queueToastId)

      toast.success(
        `Successfully purchased picks & submitted ticket! Queued for opponent...`,
      )
      void refetchPvpStatus()
    } catch (err: any) {
      toast.dismiss(toastId)
      if (!err.message?.includes("rejected")) {
        toast.error(err.message || "Failed to purchase tickets and queue.")
      }
    }
  }

  // Copy Referral link
  function handleCopyReferral() {
    if (!referralsData?.referralLink) return
    const link = `${window.location.origin}/?ref=${referralsData.referralLink}`
    navigator.clipboard.writeText(link)
    setCopiedCode(true)
    toast.success("Referral link copied!")
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4 py-4 min-h-screen">
      {/* Tabs Menu */}
      <div className="flex border-b border-border dark:border-zinc-800 gap-2 pb-px">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold tracking-tight whitespace-nowrap transition-colors ${
            activeTab === "general"
              ? "border-charcoal-primary text-charcoal-primary dark:border-white dark:text-white"
              : "border-transparent text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("pvp-arena")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold tracking-tight whitespace-nowrap transition-colors ${
            activeTab === "pvp-arena"
              ? "border-charcoal-primary text-charcoal-primary dark:border-white dark:text-white"
              : "border-transparent text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          PvP Arena
        </button>
      </div>

      {/* Prediction Markets Tab */}
      {activeTab === "general" && (
        <div className="flex flex-col gap-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 bg-white-surface dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-[10px] px-3 py-1.5 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-ash" />
              <input
                type="text"
                placeholder="Search prediction markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm w-full outline-none text-charcoal-primary dark:text-white placeholder:text-ash"
              />
            </div>

            {/* Category Tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full border transition-all ${
                  selectedCategory === null
                    ? "bg-inverse text-inverse-text border-inverse"
                    : "bg-white-surface border-border text-graphite hover:border-ash dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                }`}
              >
                All
              </button>
              {[
                "Crypto",
                "Culture",
                "Economics",
                "Politics",
                "Sports",
                "Miscellaneous",
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full border transition-all ${
                    selectedCategory === cat
                      ? "bg-inverse text-inverse-text border-inverse"
                      : "bg-white-surface border-border text-graphite hover:border-ash dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Markets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* PvP Matchup Cards (Displayed at the top of the grid) */}
            {!selectedCategory &&
              pvpEvents.map((event: any) => (
                <article
                  key={event.id}
                  onClick={() => setActiveTab("pvp-arena")}
                  className="verity-card p-5 border border-indigo-200 dark:border-indigo-950 bg-gradient-to-br from-indigo-50/20 via-transparent to-transparent hover:border-indigo-400 dark:hover:border-indigo-800 transition-all cursor-pointer group relative flex flex-col justify-between"
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
                      {event.question}
                    </h3>
                    <p className="text-xs text-graphite dark:text-zinc-400 mt-2 leading-relaxed">
                      Make 7 predictions on this matchup. Battle head-to-head
                      for ELO Rating, XP boosts, and bragging rights.
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-dashed border-indigo-100 dark:border-indigo-950/60 pt-3">
                    <div className="flex items-center gap-2 font-mono text-[10px] text-ash">
                      <Timer className="h-3.5 w-3.5" />
                      <span>
                        Closes: {new Date(event.deadline).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      Predict Now
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </article>
              ))}

            {/* Standard Prediction Markets */}
            {filteredMarkets.map((item) => {
              const market = item.market!
              const yesPercent = calculateYesPercent(market)
              const noPercent = 100 - yesPercent
              const isTradable = market.status === "tradable"
              const creatorLabel = displayHandle(item.author)
              const phase = getPhaseTag(market.status)

              return (
                <article
                  key={market.id}
                  className="verity-card p-5 flex flex-col justify-between hover:shadow-md transition-shadow border border-border dark:border-zinc-800"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2 font-mono text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-parchment-card text-charcoal-primary shadow-subtle uppercase tracking-wider font-semibold">
                          {market.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-wider font-bold ${phase.color}`}
                        >
                          {phase.label}
                        </span>
                      </div>
                      <span className="text-ash uppercase">
                        by {creatorLabel}
                      </span>
                    </div>

                    <Link href={`/markets/${market.id}`}>
                      <h3 className="text-lg font-bold tracking-tight text-charcoal-primary dark:text-white leading-tight hover:underline cursor-pointer">
                        {market.question}
                      </h3>
                    </Link>

                    {/* LP State Display */}
                    <div className="mt-2 text-[10px] font-mono text-ash flex justify-between items-center bg-stone-100/50 dark:bg-zinc-900/50 p-2 rounded-lg border border-border/40 dark:border-zinc-800/40">
                      <span>
                        LP: ${Number(market.liquidity ?? 0).toLocaleString()}{" "}
                        USDC
                      </span>
                      <span>
                        Pool: $
                        {(
                          Number(market.usdc_yes_amount || 0) +
                          Number(market.usdc_no_amount || 0)
                        ).toLocaleString()}{" "}
                        USDC
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {/* Signal / Outcome Stats */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                          <span className="text-meadow-green">
                            YES {yesPercent}%
                          </span>
                          <span className="text-ember-orange">
                            NO {noPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-stone-surface dark:bg-zinc-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-meadow-green h-full"
                            style={{ width: `${yesPercent}%` }}
                          />
                          <div
                            className="bg-ember-orange h-full"
                            style={{ width: `${noPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Conditional BUY YES/NO vs UPVOTE/DOWNVOTE signals */}
                    <div className="flex items-center gap-2 border-t border-border dark:border-zinc-800/80 pt-3 mt-1">
                      {isTradable ? (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <Link
                            href={`/markets/${market.id}?action=BUY&side=YES`}
                            className="w-full"
                          >
                            <button className="w-full bg-meadow-green hover:bg-meadow-green/90 text-white font-bold py-2 rounded-[10px] text-[11px] uppercase tracking-wider font-mono shadow-subtle flex items-center justify-center gap-1 transition-colors">
                              BUY YES
                            </button>
                          </Link>
                          <Link
                            href={`/markets/${market.id}?action=BUY&side=NO`}
                            className="w-full"
                          >
                            <button className="w-full bg-ember-orange hover:bg-ember-orange/90 text-white font-bold py-2 rounded-[10px] text-[11px] uppercase tracking-wider font-mono shadow-subtle flex items-center justify-center gap-1 transition-colors">
                              BUY NO
                            </button>
                          </Link>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            onClick={() => handleFreeVote(market.id, "YES")}
                            className="bg-meadow-green/10 hover:bg-meadow-green/15 text-meadow-green border border-meadow-green/20 dark:border-meadow-green/10 py-1.5 rounded-[8px] text-xs font-bold font-mono transition-colors shadow-subtle"
                          >
                            UPVOTE
                          </button>
                          <button
                            onClick={() => handleFreeVote(market.id, "NO")}
                            className="bg-ember-orange/10 hover:bg-ember-orange/15 text-ember-orange border border-ember-orange/20 dark:border-ember-orange/10 py-1.5 rounded-[8px] text-xs font-bold font-mono transition-colors shadow-subtle"
                          >
                            DOWNVOTE
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {filteredMarkets.length === 0 && feedItems.length > 0 && (
              <div className="col-span-full verity-card p-10 text-center text-sm text-ash">
                No standard markets match your filters.
              </div>
            )}

            {feedLoading && (
              <div className="col-span-full verity-card p-10 text-center text-sm text-ash animate-pulse">
                Loading prediction markets...
              </div>
            )}
          </div>
        </div>
      )}

      {/* PvP Arena Tab */}
      {activeTab === "pvp-arena" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Main Duelling Area */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Unified Active Duel / Queue Dashboard */}
            {(pvpStatus?.status === "queued" ||
              pvpStatus?.status === "matched") && (
              <div className="flex flex-col gap-4">
                {/* H2H Status Banner */}
                {pvpStatus.status === "queued" ? (
                  <div className="verity-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden bg-gradient-to-br from-indigo-50/20 via-transparent to-transparent">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-pulse" />

                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16 rounded-full border border-indigo-500/20 flex items-center justify-center overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent)]" />
                        <div className="absolute h-full w-0.5 bg-gradient-to-t from-indigo-500 to-transparent top-0 left-1/2 origin-bottom rotate-animate" />
                        <Swords className="h-6 w-6 text-indigo-500 dark:text-indigo-400 relative z-10 animate-pulse" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-base font-bold tracking-tight text-charcoal-primary dark:text-white">
                          Scanning for Opponent...
                        </h3>
                        <p className="text-xs text-ash mt-0.5">
                          Searching for a predictor with high selection
                          divergence.
                        </p>
                      </div>
                    </div>

                    <div className="bg-parchment-card dark:bg-zinc-950/40 px-3 py-2 rounded-[8px] border border-border dark:border-zinc-800 text-[10px] font-mono text-ash text-left space-y-0.5">
                      <p className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                        <span>Ticket Active</span>
                      </p>
                      <p>• Matchup: {pvpStatus.event?.question}</p>
                    </div>
                  </div>
                ) : (
                  <div className="verity-card p-5 border border-indigo-300 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/10 via-transparent to-transparent">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Left: You */}
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center border border-indigo-500/20 shrink-0">
                          <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="text-left">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                            Player 1
                          </span>
                          <h4 className="text-sm font-bold text-charcoal-primary dark:text-white leading-tight">
                            You
                          </h4>
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                            Score:{" "}
                            <strong className="text-sm font-bold">
                              {runningScoreUser} pts
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Middle: VS */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="h-8 w-8 rounded-full border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-950 flex items-center justify-center shadow-sm">
                          <Swords className="h-4 w-4 text-indigo-500" />
                        </div>
                        <span className="text-[9px] font-mono text-stone-400 dark:text-zinc-500 mt-1">
                          Divergence: {pvpStatus.match?.divergenceScore}/7
                        </span>
                      </div>

                      {/* Right: Opponent */}
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-right">
                        <div className="text-right">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                            Player 2
                          </span>
                          <h4 className="text-sm font-bold text-charcoal-primary dark:text-white leading-tight">
                            @{pvpStatus.opponent?.username || "Opponent"}
                          </h4>
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                            Score:{" "}
                            <strong className="text-sm font-bold">
                              {runningScoreOpponent} pts
                            </strong>
                          </span>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-border dark:border-zinc-800 shrink-0">
                          <Bot className="h-5 w-5 text-ash" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Duelling Selections Detail */}
                <div className="verity-card p-5">
                  <div className="border-b border-border dark:border-zinc-800 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-charcoal-primary dark:text-white">
                        Your Predictions & Outcomes
                      </h3>
                      <p className="text-xs text-ash mt-0.5">
                        Track your selections, payouts, and opponent picks in
                        real-time.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {pvpStatus.ticket?.picks.map((pick: any, idx: number) => {
                      const childOpt = pvpStatus.event?.options.find(
                        (o: any) => o.id === pick.marketId,
                      )
                      const oppPick = pvpStatus.opponent?.picks.find(
                        (p: any) => p.marketId === pick.marketId,
                      )

                      // Payout comes from backend shares (same as normal markets)
                      const shares = pick.shares ?? 0
                      const invested = pick.investedUsdc ?? 0
                      const potentialPayout = shares.toFixed(2)

                      return (
                        <div
                          key={pick.marketId}
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-parchment-card dark:bg-zinc-900/40 border border-border dark:border-zinc-800/85 gap-3"
                        >
                          {/* Proposition Title */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-zinc-200">
                              {idx + 1}.{" "}
                              {childOpt?.optionName ||
                                pick.optionName ||
                                "Pick"}
                            </span>
                            <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <span>
                                Shares: <strong>{invested.toFixed(2)}</strong>
                              </span>
                            </span>
                          </div>

                          {/* Selections comparing */}
                          <div className="flex flex-wrap items-center gap-3 shrink-0">
                            {/* Your Pick */}
                            <div className="flex flex-col items-start bg-white-surface dark:bg-zinc-950 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800">
                              <span className="text-[9px] font-mono text-ash uppercase">
                                You
                              </span>
                              <span
                                className={`text-xs font-bold ${
                                  pick.selection === "YES"
                                    ? "text-meadow-green"
                                    : "text-ember-orange"
                                }`}
                              >
                                {pick.selection === "YES"
                                  ? childOpt?.yesCondition || "YES"
                                  : childOpt?.noCondition || "NO"}
                              </span>
                            </div>

                            {/* Opponent's Pick */}
                            <div className="flex flex-col items-start bg-white-surface dark:bg-zinc-950 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 min-w-[100px]">
                              <span className="text-[9px] font-mono text-ash uppercase">
                                Opponent
                              </span>
                              {pvpStatus.status === "queued" ? (
                                <span className="text-xs font-semibold text-ash font-mono italic animate-pulse">
                                  Waiting...
                                </span>
                              ) : (
                                <span
                                  className={`text-xs font-bold ${
                                    oppPick?.selection === "YES"
                                      ? "text-meadow-green"
                                      : "text-ember-orange"
                                  }`}
                                >
                                  {oppPick?.selection === "YES"
                                    ? childOpt?.yesCondition || "YES"
                                    : childOpt?.noCondition || "NO"}
                                </span>
                              )}
                            </div>

                            {/* Outcome Points */}
                            <div className="flex flex-col items-center justify-center shrink-0 min-w-[70px]">
                              <span className="text-[9px] font-mono text-stone-400 dark:text-zinc-500 uppercase">
                                Points
                              </span>
                              {pick.isCorrect === null ? (
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-stone-100 dark:bg-zinc-900 text-stone-500 border border-stone-200 dark:border-zinc-800 mt-0.5">
                                  Pending
                                </span>
                              ) : pick.isCorrect === true ? (
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 mt-0.5">
                                  +70 pts
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 mt-0.5">
                                  +30 pts
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. If no active duel, show Ticket Builder Form */}
            {(!pvpStatus ||
              pvpStatus.status === "resolved" ||
              pvpStatus.status === "cancelled") && (
              <div className="verity-card p-5 flex flex-col gap-4">
                <div className="border-b border-border dark:border-zinc-800 pb-3">
                  <h3 className="text-lg font-bold tracking-tight text-charcoal-primary dark:text-white flex items-center gap-2">
                    Arena ticket builder
                  </h3>
                  <p className="text-xs text-ash mt-0.5">
                    Submit selections to queue for head-to-head matchup.
                  </p>
                </div>

                {pvpEventsLoading && (
                  <div className="p-8 text-center text-sm text-ash animate-pulse">
                    Loading active match events...
                  </div>
                )}

                {pvpEvents.length === 0 && !pvpEventsLoading && (
                  <div className="p-8 text-center text-sm text-ash border border-dashed border-border dark:border-zinc-800 rounded-[12px] bg-parchment-card dark:bg-zinc-950/20">
                    No active PvP events right now. Check back soon for new
                    matchups!
                  </div>
                )}

                {pvpEvents.length > 0 && selectedPvpEvent && (
                  <div className="flex flex-col gap-4">
                    {/* Event Selector Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                        Select Matchup Event
                      </label>
                      <select
                        value={selectedPvpEventId || ""}
                        onChange={(e) => setSelectedPvpEventId(e.target.value)}
                        className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 text-sm rounded-[10px] text-charcoal-primary dark:text-white outline-none cursor-pointer focus:border-indigo-500 transition-colors"
                      >
                        {pvpEvents.map((evt: any) => (
                          <option key={evt.id} value={evt.id}>
                            {evt.question}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* 7 child questions inputs */}
                    <div className="space-y-3">
                      <span className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                        Propositions (Predict exactly 7 options)
                      </span>

                      <div className="space-y-2.5">
                        {selectedPvpEvent.options.map(
                          (opt: any, idx: number) => (
                            <div
                              key={opt.id}
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-parchment-card dark:bg-zinc-900/40 border border-border dark:border-zinc-800/80 hover:border-ash dark:hover:border-zinc-800 transition-all gap-3"
                            >
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium tracking-tight text-charcoal-primary dark:text-zinc-200">
                                  {idx + 1}. {opt.optionName}
                                </span>
                                <span className="text-[10px] text-ash mt-1.5 font-mono flex items-center gap-1.5 flex-wrap">
                                  <span>
                                    Pool:{" "}
                                    <strong className="text-charcoal-primary dark:text-white">
                                      $
                                      {Number(
                                        opt.liquidity ?? 40,
                                      ).toLocaleString()}{" "}
                                      USDC
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {opt.yesCondition || "YES"}:{" "}
                                    <strong className="text-meadow-green">
                                      {opt.yesCondition || "YES"}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {opt.noCondition || "NO"}:{" "}
                                    <strong className="text-ember-orange">
                                      {opt.noCondition || "NO"}
                                    </strong>
                                  </span>
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end mt-2 sm:mt-0">
                                {/* YES / NO Selection Buttons (Aliased to Team Names) */}
                                <div className="flex bg-white-surface dark:bg-zinc-900 border border-border dark:border-zinc-800/80 rounded-[8px] p-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPvpSelections((prev) => ({
                                        ...prev,
                                        [opt.id]: "YES",
                                      }))
                                    }
                                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold font-mono transition-all ${
                                      pvpSelections[opt.id] === "YES"
                                        ? "bg-meadow-green text-white shadow-subtle"
                                        : "text-ash hover:text-charcoal-primary dark:hover:text-white"
                                    }`}
                                  >
                                    {opt.yesCondition || "YES"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPvpSelections((prev) => ({
                                        ...prev,
                                        [opt.id]: "NO",
                                      }))
                                    }
                                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold font-mono transition-all ${
                                      pvpSelections[opt.id] === "NO"
                                        ? "bg-ember-orange text-white shadow-subtle"
                                        : "text-ash hover:text-charcoal-primary dark:hover:text-white"
                                    }`}
                                  >
                                    {opt.noCondition || "NO"}
                                  </button>
                                </div>

                                {/* Add Liquidity (LP) button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLiquidityMarketId(opt.id)
                                    setLiquidityAmount("10")
                                  }}
                                  className="px-2.5 py-1.5 rounded-[8px] text-[10px] font-bold font-mono transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0"
                                >
                                  + LP
                                </button>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Bet amount settings and calculated totals */}
                    <div className="flex flex-col gap-3 bg-stone-100/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-border/60 dark:border-zinc-800/40 mt-4 mb-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono font-bold text-ash uppercase block">
                            Bet Amount per selection
                          </span>
                          <span className="text-[10px] text-ash">
                            Each of the 7 bets will be purchased for this
                            amount.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={betAmountPerSelection}
                            onChange={(e) =>
                              setBetAmountPerSelection(
                                Math.max(1, Number(e.target.value)),
                              )
                            }
                            className="w-20 h-9 px-2 border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 text-xs font-bold font-mono rounded-md text-charcoal-primary dark:text-white outline-none focus:border-indigo-500 text-right"
                          />
                          <span className="text-xs font-mono font-bold text-charcoal-primary dark:text-zinc-400">
                            USDC
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-dashed border-border/60 dark:border-zinc-800/60 pt-2.5 mt-1">
                        <span className="text-xs font-mono text-ash font-bold uppercase">
                          Total Ticket Cost (7 Selections)
                        </span>
                        <strong className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                          {betAmountPerSelection * 7} USDC
                        </strong>
                      </div>
                    </div>

                    {/* Double Boost indicator and submit button */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-t border-border dark:border-zinc-800 pt-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Zap
                          className={`h-4.5 w-4.5 ${referralsData && referralsData.doubleBoostRemaining > 0 ? "text-indigo-500 animate-pulse" : "text-ash"}`}
                        />
                        <span className="text-xs font-mono text-ash">
                          ⚡ Boosts Remaining:{" "}
                          <strong className="text-charcoal-primary dark:text-white">
                            {referralsData?.doubleBoostRemaining ?? 0}
                          </strong>
                          {referralsData &&
                            referralsData.doubleBoostRemaining > 0 &&
                            " (Auto-active 2x XP)"}
                        </span>
                      </div>

                      <button
                        onClick={handleSubmitPvpTicket}
                        disabled={submitTicketMutation.isPending}
                        className="verity-pill px-6 h-11 bg-indigo-600 text-white hover:bg-indigo-500 font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submitTicketMutation.isPending
                          ? "Queuing..."
                          : "Submit ticket & Queue"}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Match History */}
            <div className="verity-card overflow-hidden">
              <div className="p-4 border-b border-border dark:border-zinc-800 bg-white-surface/40 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white">
                  My Arena Duel History
                </h3>
                <p className="text-xs text-ash mt-0.5 font-mono">
                  Past resolved PvP head-to-head match outcomes.
                </p>
              </div>

              {matchHistory.length === 0 ? (
                <div className="p-8 text-center text-sm text-ash font-mono">
                  You haven't resolved any Arena matches yet.
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-zinc-800">
                  {matchHistory.map((item: any) => (
                    <div
                      key={item.matchId}
                      className="p-4 flex items-center justify-between hover:bg-white-surface/20 dark:hover:bg-zinc-900/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white truncate">
                          {item.eventQuestion}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-ash">
                          <span>
                            Opponent: @{item.opponent?.username || "Unknown"}
                          </span>
                          <span>•</span>
                          <span>
                            Score: {item.myScore} vs {item.oppScore}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider ${
                              item.outcome === "WIN"
                                ? "bg-green-500/10 text-green-600"
                                : item.outcome === "LOSS"
                                  ? "bg-red-500/10 text-red-600"
                                  : "bg-zinc-500/10 text-zinc-500"
                            }`}
                          >
                            {item.outcome}
                          </span>
                          <span className="block text-[10px] font-mono text-ash mt-1">
                            +{item.xpEarned} XP (
                            {item.eloChange >= 0 ? "+" : ""}
                            {item.eloChange} ELO)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Profile stats & Referrals & Boosts info card */}
          <div className="flex flex-col gap-4">
            {/* Arena stats summary */}
            <div className="verity-card p-5 bg-gradient-to-br from-indigo-50/10 to-transparent dark:from-indigo-950/5">
              <div className="flex items-center gap-2.5 border-b border-border dark:border-zinc-800 pb-3 mb-4">
                <Award className="h-5 w-5 text-indigo-500" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-charcoal-primary dark:text-white">
                  My Arena stats
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[10px] bg-white-surface dark:bg-zinc-900/50 p-3 shadow-subtle text-center">
                  <span className="text-[10px] font-mono text-ash uppercase block">
                    ELO Rating
                  </span>
                  <strong className="text-xl font-mono text-charcoal-primary dark:text-white block mt-1">
                    {profile?.eloRating ?? 1000}
                  </strong>
                </div>
                <div className="rounded-[10px] bg-white-surface dark:bg-zinc-900/50 p-3 shadow-subtle text-center">
                  <span className="text-[10px] font-mono text-ash uppercase block">
                    Arena XP
                  </span>
                  <strong className="text-xl font-mono text-indigo-600 dark:text-indigo-400 block mt-1">
                    {profile?.arenaXp ?? 0}
                  </strong>
                </div>
              </div>

              <div className="mt-4 border-t border-border dark:border-zinc-800 pt-3 flex items-center justify-between text-xs font-mono text-ash">
                <span>Record:</span>
                <span className="font-semibold text-charcoal-primary dark:text-white">
                  {profile?.pvpMatchesWonCount ?? 0}W -{" "}
                  {profile?.pvpMatchesLostCount ?? 0}L -{" "}
                  {profile?.pvpMatchesDrawnCount ?? 0}D
                </span>
              </div>
            </div>

            {/* Referrals & Boosts Panel */}
            <div className="verity-card p-5">
              <div className="flex items-center gap-2 border-b border-border dark:border-zinc-800 pb-3 mb-4">
                <Users className="h-4.5 w-4.5 text-indigo-500" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-charcoal-primary dark:text-white">
                  Referrals & Boosts
                </h3>
              </div>

              <div className="space-y-4">
                {/* Double Boost card count */}
                <div className="rounded-[12px] bg-indigo-500/10 p-4 border border-indigo-500/20 text-center relative overflow-hidden">
                  <div className="absolute right-2 bottom-2 opacity-5">
                    <Zap className="h-16 w-16 text-indigo-500" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Co-Op Double Boosts
                  </span>
                  <div className="text-3xl font-mono font-bold text-charcoal-primary dark:text-white mt-1">
                    {referralsData?.doubleBoostRemaining ?? 0}
                  </div>
                  <p className="text-[11px] leading-normal text-ash mt-2 max-w-[200px] mx-auto">
                    Double-boosts award 2x XP for matches resolved. Unlock 2
                    boosts when referred friends win their first duel!
                  </p>
                </div>

                {/* Referral Code / Link */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                    My Referral Link
                  </label>
                  <div className="flex h-11 items-center rounded-[10px] border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 px-3 transition-colors">
                    <input
                      type="text"
                      readOnly
                      value={
                        referralsData?.referralLink
                          ? `${window.location.origin}/?ref=${referralsData.referralLink}`
                          : "Loading link..."
                      }
                      className="w-full bg-transparent text-xs text-ash truncate outline-none select-all"
                    />
                    <button
                      onClick={handleCopyReferral}
                      disabled={!referralsData?.referralLink}
                      className="ml-2 h-7 w-7 shrink-0 rounded-md bg-parchment-card hover:bg-stone-surface border border-border dark:border-zinc-800 dark:bg-zinc-800 flex items-center justify-center text-charcoal-primary dark:text-white transition-colors"
                    >
                      {copiedCode ? (
                        <Check className="h-3.5 w-3.5 text-meadow-green" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-ash font-mono leading-normal pt-1">
                    Invite friends. When they win their first Arena match, you
                    both get 2 double-boosts and you get 5% XP kickback.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Liquidity Modal for PvP Child Markets */}
      {liquidityMarketId && optionForLP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/35 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setLiquidityMarketId(null)}
          />
          <section className="verity-card relative z-10 w-full max-w-[420px] bg-white dark:bg-zinc-950 p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-150 rounded-2xl border border-border dark:border-zinc-800">
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-border dark:border-zinc-800">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-ash">
                Add Pool Liquidity
              </span>
              <button
                onClick={() => setLiquidityMarketId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-parchment-card hover:bg-stone-surface dark:bg-zinc-900 text-charcoal-primary dark:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-ash uppercase block">
                  CHILD MARKET
                </span>
                <h4 className="text-sm font-bold text-charcoal-primary dark:text-white mt-1 leading-normal">
                  {optionForLP.optionName}
                </h4>
                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">
                  Parent: {selectedPvpEvent?.question}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono font-bold text-ash uppercase">
                  <span>Amount to Deposit (USDC)</span>
                  <span>
                    Balance: {(Number(rawBalance) / 1e6).toLocaleString()} USDC
                  </span>
                </div>
                <div className="flex h-11 items-center rounded-[10px] border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 px-3">
                  <input
                    type="number"
                    min="1"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    className="w-full bg-transparent text-sm text-charcoal-primary dark:text-white outline-none"
                  />
                  <button
                    onClick={() =>
                      setLiquidityAmount((Number(rawBalance) / 1e6).toString())
                    }
                    className="text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/20"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <p className="text-[10px] font-mono text-ash leading-normal bg-stone-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border/40 dark:border-zinc-800/40">
                • Deposits USDC liquidity into the child market pool to
                facilitate trading.
                <br />• Earn LP shares and trading fees from all BUY/SELL token
                trades in this market.
              </p>

              <button
                onClick={async () => {
                  const amt = Number(liquidityAmount)
                  if (isNaN(amt) || amt <= 0) {
                    toast.error("Please enter a valid deposit amount.")
                    return
                  }
                  if (amt > Number(rawBalance) / 1e6) {
                    toast.error("Insufficient USDC balance in wallet.")
                    return
                  }
                  setIsAddingLiquidity(true)
                  try {
                    await addPoolLiquidity(optionForLP.id, profile!.id, amt)
                    setLiquidityMarketId(null)
                    void refetchPvpStatus()
                  } catch (err: any) {
                    // error is toasted in addPoolLiquidity hook
                  } finally {
                    setIsAddingLiquidity(false)
                  }
                }}
                disabled={isAddingLiquidity}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all rounded-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAddingLiquidity ? "Depositing..." : "Deposit Liquidity"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
