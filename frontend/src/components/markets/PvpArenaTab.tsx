"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/components/providers/AuthModals"
import { useMarketResolution } from "@/hooks/useMarketResolution"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { arcUsdcAddress, FPMM_ADDRESS, publicClient } from "@/lib/arc"
import {
  useSubmitPvpTicketMutation,
  useCastFreeVoteMutation,
  useExecuteMarketTradeMutation,
} from "@/store/verity/verityQueries"
import {
  Swords,
  User,
  Bot,
  Zap,
  ChevronRight,
  Award,
  HelpCircle,
  Trophy,
  Flag,
  Target,
  ChevronDown,
  ChevronUp,
  RectangleVertical,
} from "lucide-react"
import { toast } from "@/lib/toast"
import PvpLiquidityModal from "./PvpLiquidityModal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "")
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`
}

const cleanOutcomeName = (name: string, teamA: string, teamB: string) => {
  const lowerName = name.toLowerCase().trim()
  const lowerA = teamA.toLowerCase().trim()
  const lowerB = teamB.toLowerCase().trim()

  if (
    lowerName === "match ends in a draw" ||
    lowerName === "match ends with equal corners" ||
    lowerName === "match ends with equal yellow cards" ||
    lowerName === "match ends with equal fouls" ||
    lowerName === "draw"
  ) {
    return "Draw"
  }

  if (lowerName.includes("has more corners")) {
    if (lowerName.includes(lowerA)) return teamA
    if (lowerName.includes(lowerB)) return teamB
  }
  if (lowerName.includes("has more yellow cards")) {
    if (lowerName.includes(lowerA)) return teamA
    if (lowerName.includes(lowerB)) return teamB
  }
  if (lowerName.includes("commits more fouls")) {
    if (lowerName.includes(lowerA)) return teamA
    if (lowerName.includes(lowerB)) return teamB
  }

  // Totals: extract line
  const overMatch = name.match(/over\s+(\d+(?:\.\d+)?)/i)
  if (overMatch) {
    return `Over ${overMatch[1]}`
  }

  const underMatch = name.match(/under\s+(\d+(?:\.\d+)?)/i)
  if (underMatch) {
    return `Under ${underMatch[1]}`
  }

  const cleaned = name
    .replace(/\s+wins\s+the\s+match/i, "")
    .replace(/\s+wins/i, "")
    .replace(/\s+scores\s+first\s+goal/i, "")
    .replace(/\s+leads\s+at\s+halftime/i, "")
    .replace(/\s+keeps\s+a\s+clean\s+sheet/i, "")
    .replace(/\s+commits\s+more\s+fouls/i, "")
    .trim()

  return cleaned
}

interface PvpArenaTabProps {
  pvpEvents: any[]
  pvpEventsLoading: boolean
  pvpStatus: any
  pvpStatusLoading: boolean
  refetchPvpStatus: () => void
  profile: any
  referralsData: any
  selectedPvpEventId: string | null
  setSelectedPvpEventId: (id: string | null) => void
}

export default function PvpArenaTab({
  pvpEvents,
  pvpEventsLoading,
  pvpStatus,
  pvpStatusLoading,
  refetchPvpStatus,
  profile,
  referralsData,
  selectedPvpEventId,
  setSelectedPvpEventId,
}: PvpArenaTabProps) {
  const { user, executeTxBatch, closeTxConfirm } = useAuth()
  const { redeemMultipleWinnings } = useMarketResolution()
  const { rawBalance } = useUsdcBalance()
  const submitTicketMutation = useSubmitPvpTicketMutation()
  const { mutateAsync: executeMarketTrade } = useExecuteMarketTradeMutation()

  // Local state for ticket builder
  const [showBuilderOverride, setShowBuilderOverride] = useState<boolean>(false)
  const [betAmountPerSelection, setBetAmountPerSelection] = useState<number>(5)
  const [pvpSelections, setPvpSelections] = useState<Record<string, string>>({})
  const [selectedLines, setSelectedLines] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [showTooltip, setShowTooltip] = useState<boolean>(false)

  // Local state for child market liquidity modal
  const [liquidityMarketId, setLiquidityMarketId] = useState<string | null>(
    null,
  )

  // Poll matchmaking status if queued
  useEffect(() => {
    let interval: NodeJS.Timeout
    const isQueued = pvpStatus?.status === "queued"

    if (isQueued) {
      interval = setInterval(() => {
        void refetchPvpStatus()
      }, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [pvpStatus, refetchPvpStatus])

  // Get active PvP event
  const selectedPvpEvent = useMemo(() => {
    if (!pvpEvents || pvpEvents.length === 0) return null
    if (selectedPvpEventId) {
      return (
        pvpEvents.find((e: any) => e.id === selectedPvpEventId) || pvpEvents[0]
      )
    }
    return pvpEvents[0]
  }, [pvpEvents, selectedPvpEventId])

  // Reset selections when event changes
  useEffect(() => {
    if (selectedPvpEvent) {
      setPvpSelections({})
      setShowBuilderOverride(false)
    }
  }, [selectedPvpEvent])

  const runningScoreUser = useMemo(() => {
    if (!pvpStatus?.ticket?.picks) return 0
    return pvpStatus.ticket.picks.filter((p: any) => p.isCorrect === true)
      .length
  }, [pvpStatus])

  const runningScoreOpponent = useMemo(() => {
    if (!pvpStatus?.opponent?.picks) return 0
    return pvpStatus.opponent.picks.filter((p: any) => p.isCorrect === true)
      .length
  }, [pvpStatus])

  const optionForLP = useMemo(() => {
    if (!liquidityMarketId || !selectedPvpEvent) return null
    return selectedPvpEvent.options.find((o: any) => o.id === liquidityMarketId)
  }, [liquidityMarketId, selectedPvpEvent])

  const totalVolume = useMemo(() => {
    if (!selectedPvpEvent?.options) return 0
    return selectedPvpEvent.options.reduce(
      (sum: number, opt: any) => sum + Number(opt.liquidity ?? 0),
      0,
    )
  }, [selectedPvpEvent])

  const formattedDeadline = useMemo(() => {
    if (!selectedPvpEvent?.deadline) return ""
    const date = new Date(selectedPvpEvent.deadline)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }, [selectedPvpEvent])

  // Parse team names from event question
  const parsedTeams = useMemo(() => {
    if (!selectedPvpEvent?.question) return { teamA: "Team A", teamB: "Team B" }
    const vsMatch = selectedPvpEvent.question.match(/(.+?)\s+vs\.?\s+(.+)/i)
    if (vsMatch) return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() }
    const dashMatch = selectedPvpEvent.question.match(/(.+?)\s+-\s+(.+)/)
    if (dashMatch)
      return { teamA: dashMatch[1].trim(), teamB: dashMatch[2].trim() }
    return { teamA: "Team A", teamB: "Team B" }
  }, [selectedPvpEvent])

  // Group options by optionGroup for category card rendering
  const groupedOptions = useMemo(() => {
    if (!selectedPvpEvent?.options) return {}
    const groups: Record<string, any[]> = {}
    for (const opt of selectedPvpEvent.options) {
      const group = opt.optionGroup || "other"
      if (!groups[group]) groups[group] = []
      groups[group].push(opt)
    }
    return groups
  }, [selectedPvpEvent])

  // Helper to toggle selection while enforcing max 1 pick per option group
  const handleToggleSelection = (optId: string, selection: string) => {
    setPvpSelections((prev) => {
      const next = { ...prev }

      if (next[optId] === selection) {
        delete next[optId]
        return next
      }

      const currentOpt = selectedPvpEvent?.options?.find(
        (o: any) => o.id === optId,
      )
      const group = currentOpt?.optionGroup

      if (group) {
        selectedPvpEvent.options.forEach((otherOpt: any) => {
          if (otherOpt.id !== optId && otherOpt.optionGroup === group) {
            delete next[otherOpt.id]
          }
        })
      }

      next[optId] = selection
      return next
    })
  }

  // Submit PvP ticket transaction batch
  async function handleSubmitPvpTicket() {
    if (!profile || !user?.walletAddress) {
      toast.error("Connect your wallet to queue for the Arena.")
      return
    }
    if (!selectedPvpEvent) return

    const picks = Object.keys(pvpSelections).map((marketId) => {
      const selection = pvpSelections[marketId]
      const opt = selectedPvpEvent.options.find((o: any) => o.id === marketId)

      let price = 0.5
      const isMulti = opt && opt.outcomeCount && opt.outcomeCount > 2
      if (isMulti) {
        const outcomeIndex = opt.outcomes.findIndex(
          (o: any) => o.toLowerCase().trim() === selection.toLowerCase().trim(),
        )
        const validIndex = outcomeIndex >= 0 ? outcomeIndex : 0
        price = opt.outcomePrices?.[validIndex] ?? 1 / opt.outcomeCount
      } else {
        const yesPool = Number(opt?.usdcYesAmount ?? 0)
        const noPool = Number(opt?.usdcNoAmount ?? 0)
        const totalPool = yesPool + noPool
        let yesProb = 50
        if (totalPool > 0) {
          yesProb = (yesPool / totalPool) * 100
        }
        const noProb = 100 - yesProb
        price = selection === "YES" ? yesProb / 100 : noProb / 100
      }
      const shares = betAmountPerSelection / (price || 0.5)

      return {
        marketId,
        selection,
        shares,
      }
    })

    if (picks.length < 3) {
      toast.error(
        "Please make a selection for at least 3 options from different categories.",
      )
      return
    }

    const totalAmount = betAmountPerSelection * picks.length
    const rawTotalAmount = BigInt(Math.round(totalAmount * 1e6))

    if (rawBalance < rawTotalAmount) {
      toast.error(
        `Insufficient USDC balance. You need at least ${totalAmount} USDC to submit this ticket, but your balance is ${(Number(rawBalance) / 1e6).toFixed(2)} USDC.`,
      )
      return
    }

    setIsSubmitting(true)
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

      // If allowance is too low, add approval call
      if (allowance < rawTotalAmount) {
        batchCalls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, rawTotalAmount],
        })
      }

      // 2. Build child buy calls
      const rawAmountPerSelection = BigInt(
        Math.round(betAmountPerSelection * 1e6),
      )
      picks.forEach((pick) => {
        const opt = selectedPvpEvent.options.find(
          (o: any) => o.id === pick.marketId,
        )
        const isMulti = opt && opt.outcomeCount && opt.outcomeCount > 2

        if (isMulti) {
          const outcomeIndex = opt.outcomes.findIndex(
            (o: any) =>
              o.toLowerCase().trim() === pick.selection.toLowerCase().trim(),
          )
          const validIndex = outcomeIndex >= 0 ? outcomeIndex : 0

          batchCalls.push({
            contractAddress: FPMM_ADDRESS,
            abiFunctionSignature: "buyOutcome(bytes32,uint256,uint256)",
            abiParameters: [
              formatMarketId(pick.marketId),
              BigInt(validIndex),
              rawAmountPerSelection,
            ],
          })
        } else {
          const isYes = pick.selection === "YES"
          batchCalls.push({
            contractAddress: FPMM_ADDRESS,
            abiFunctionSignature: "buy(bytes32,bool,uint256)",
            abiParameters: [
              formatMarketId(pick.marketId),
              isYes,
              rawAmountPerSelection,
            ],
          })
        }
      })

      toast.dismiss(toastId)

      // 3. Execute batched on-chain buy calls
      const hash = await executeTxBatch(
        batchCalls,
        `Purchase ${picks.length}-selection PvP ticket for ${totalAmount} USDC`,
        totalAmount,
        undefined,
        true, // Defer closing confirmation modal
      )

      // 4. Register trades on backend
      const finalizeToastId = toast.loading(
        "Finalizing on-chain trades on Verity...",
      )
      const tradePromises = picks.map((pick) => {
        return executeMarketTrade({
          marketId: pick.marketId,
          profileId: profile.id,
          side: pick.selection,
          action: "BUY",
          amount: betAmountPerSelection,
          grossAmount: pick.shares,
          txHash: hash,
        })
      })
      await Promise.all(tradePromises)
      toast.dismiss(finalizeToastId)

      // 5. Submit the ticket to queue
      const queueToastId = toast.loading("Queueing for PvP match...")
      await submitTicketMutation.mutateAsync({
        parentMarketId: selectedPvpEvent.id,
        picks,
      })
      toast.dismiss(queueToastId)

      closeTxConfirm() // Close modal after everything finishes successfully

      toast.success(
        "Successfully purchased picks & submitted ticket! Queued for opponent...",
      )
      void refetchPvpStatus()
      setShowBuilderOverride(false)
    } catch (err: any) {
      closeTxConfirm() // Close modal on error
      toast.dismiss(toastId)
      if (!err.message?.includes("rejected")) {
        toast.error(err.message || "Failed to purchase tickets and queue.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // PvP Arena Skeleton Loader
  if (pvpEventsLoading || pvpStatusLoading) {
    return (
      <div className="lg:col-span-2 flex flex-col gap-4 animate-pulse">
        <div className="verity-card p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-stone-surface dark:bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-4 w-48 bg-stone-surface dark:bg-zinc-800 rounded" />
              <div className="h-3 w-64 bg-stone-surface dark:bg-zinc-800 rounded" />
            </div>
          </div>
          <div className="h-10 w-32 bg-stone-surface dark:bg-zinc-800 rounded-lg" />
        </div>

        <div className="verity-card p-5 flex flex-col gap-4">
          <div className="border-b border-border dark:border-zinc-800 pb-3 space-y-2">
            <div className="h-5 w-52 bg-stone-surface dark:bg-zinc-800 rounded" />
            <div className="h-3 w-72 bg-stone-surface dark:bg-zinc-800 rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-28 bg-stone-surface dark:bg-zinc-800 rounded" />
            <div className="h-11 w-full bg-stone-surface dark:bg-zinc-900 rounded-[10px]" />
          </div>
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between border-b border-border dark:border-zinc-800 pb-2 mb-2">
              <div className="flex items-center gap-3">
                <div className="h-4 w-24 bg-stone-surface dark:bg-zinc-800 rounded animate-pulse" />
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <div className="h-4 w-24 bg-stone-surface dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="h-3 w-32 bg-stone-surface dark:bg-zinc-800 rounded animate-pulse" />
            </div>
            <div className="divide-y divide-border/60 dark:divide-zinc-800/60">
              {Array.from({
                length: selectedPvpEvent?.options?.length || 5,
              }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-4 gap-4 px-1"
                >
                  {/* Left: Option Name & Vol */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 w-2/3 bg-stone-surface dark:bg-zinc-800 rounded" />
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="h-3 w-12 bg-stone-surface dark:bg-zinc-800 rounded" />
                      <div className="h-4 w-10 bg-stone-surface dark:bg-zinc-800 rounded-[6px]" />
                    </div>
                  </div>

                  {/* Middle: Implied Probability */}
                  <div className="w-16 sm:w-24 flex justify-center shrink-0">
                    <div className="h-5 w-8 bg-stone-surface dark:bg-zinc-800 rounded" />
                  </div>

                  {/* Right: Buttons */}
                  <div className="flex gap-2 shrink-0">
                    <div className="h-9 w-[105px] sm:w-[120px] bg-stone-surface dark:bg-zinc-800 rounded-[10px]" />
                    <div className="h-9 w-[105px] sm:w-[120px] bg-stone-surface dark:bg-zinc-800 rounded-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hasActiveDuel =
    pvpStatus?.status === "queued" ||
    pvpStatus?.status === "matched" ||
    pvpStatus?.status === "resolved"

  const isEventEnded =
    selectedPvpEvent &&
    (new Date() >= new Date(selectedPvpEvent.deadline) ||
      selectedPvpEvent.status === "resolved")

  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      {/* Event Selector Header Card (Always visible if events exist) */}
      {pvpEvents.length > 0 && selectedPvpEvent && (
        <div className="verity-card p-5 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                Select Matchup Event
              </label>
              <Select
                value={selectedPvpEventId || ""}
                onValueChange={(val) => setSelectedPvpEventId(val)}
              >
                <SelectTrigger className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 text-sm rounded-[10px] text-charcoal-primary dark:text-white focus:border-indigo-500 transition-colors cursor-pointer justify-between">
                  <SelectValue placeholder="Select Matchup Event" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="bg-white dark:bg-zinc-900 border border-border dark:border-zinc-800"
                >
                  {pvpEvents.map((evt: any) => (
                    <SelectItem
                      key={evt.id}
                      value={evt.id}
                      className="cursor-pointer"
                    >
                      {evt.question}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col items-start md:items-end justify-center shrink-0">
              <span className="text-[10px] font-mono text-ash uppercase font-bold tracking-wider">
                Predict min. 3
              </span>
              <div className="flex items-center gap-3 text-xs font-mono text-ash font-medium mt-1.5">
                <span
                  className="flex items-center gap-1.5"
                  title="Total Volume (USDC)"
                >
                  ${totalVolume.toLocaleString()} Vol
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <span className="flex items-center gap-1.5">
                  {formattedDeadline}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasActiveDuel && !showBuilderOverride && (
        <div className="flex flex-col gap-4">
          {/* H2H Status Banner */}
          {pvpStatus.status === "queued" ? (
            <div className="verity-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden bg-sky-blue/10">
              <div className="absolute top-0 left-0 w-full h-1 bg-sky-blue animate-pulse" />

              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-full border border-sky-blue/20 flex items-center justify-center overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,144,255,0.06),transparent)]" />
                  <div className="absolute h-full w-0.5 bg-sky-blue top-0 left-1/2 origin-bottom rotate-animate" />
                  <Swords className="h-6 w-6 text-sky-blue relative z-10 animate-pulse" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold tracking-tight text-charcoal-primary dark:text-white">
                    Scanning for Opponent...
                  </h3>
                  <p className="text-xs text-ash mt-0.5">
                    Searching for a predictor with high selection divergence.
                  </p>
                </div>
              </div>

              <div className="bg-parchment-card dark:bg-zinc-950/40 px-3 py-2 rounded-[8px] border border-border dark:border-zinc-800 text-[10px] font-mono text-ash text-left space-y-0.5">
                <p className="flex items-center gap-1.5 font-semibold text-sky-blue">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-blue animate-ping" />
                  <span>Ticket Active</span>
                </p>
                <p>• Matchup: {pvpStatus.event?.question}</p>
              </div>
            </div>
          ) : pvpStatus.status === "resolved" ? (
            <div className="verity-card p-5 border border-sky-blue/30 dark:border-sky-blue/20 bg-sky-blue/5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Left: You */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="h-10 w-10 rounded-full bg-sky-blue/10 dark:bg-sky-blue/20 flex items-center justify-center border border-sky-blue/20 shrink-0">
                    <User className="h-5 w-5 text-sky-blue" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                      Player 1
                    </span>
                    <h4 className="text-sm font-bold text-charcoal-primary dark:text-white leading-tight">
                      You
                    </h4>
                    <span className="text-[10px] font-mono text-sky-blue mt-0.5 block">
                      Score:{" "}
                      <strong className="text-sm font-bold">
                        {runningScoreUser} pts
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Middle: VS */}
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className={`text-base font-extrabold uppercase tracking-widest ${
                      runningScoreUser > runningScoreOpponent
                        ? "text-meadow-green"
                        : runningScoreUser < runningScoreOpponent
                          ? "text-ember-orange"
                          : "text-ash"
                    }`}
                  >
                    {runningScoreUser > runningScoreOpponent
                      ? "YOU WON 🏆"
                      : runningScoreUser < runningScoreOpponent
                        ? "YOU LOST ❌"
                        : "DRAW 🤝"}
                  </span>
                  <span className="text-[9px] font-mono text-stone-400 dark:text-zinc-500 mt-1">
                    Divergence: {pvpStatus.match?.divergenceScore} picks
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
                    <span className="text-[10px] font-mono text-sky-blue mt-0.5 block">
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

              <div className="mt-4 pt-4 border-t border-border dark:border-zinc-800">
                <p className="text-xs text-ash">
                  Duel is resolved. Arena XP has been awarded.
                </p>
              </div>
            </div>
          ) : (
            <div className="verity-card p-5 border border-sky-blue/30 dark:border-sky-blue/20 bg-sky-blue/5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Left: You */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="h-10 w-10 rounded-full bg-sky-blue/10 dark:bg-sky-blue/20 flex items-center justify-center border border-sky-blue/20 shrink-0">
                    <User className="h-5 w-5 text-sky-blue" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                      Player 1
                    </span>
                    <h4 className="text-sm font-bold text-charcoal-primary dark:text-white leading-tight">
                      You
                    </h4>
                    <span className="text-[10px] font-mono text-sky-blue mt-0.5 block">
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
                    <Swords className="h-4 w-4 text-sky-blue" />
                  </div>
                  <span className="text-[9px] font-mono text-stone-400 dark:text-zinc-500 mt-1">
                    Divergence: {pvpStatus.match?.divergenceScore} picks
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
                    <span className="text-[10px] font-mono text-sky-blue mt-0.5 block">
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

            {(() => {
              const claimablePicks =
                pvpStatus.ticket?.picks?.filter(
                  (p: any) => p.isCorrect === true && (p.shares ?? 0) > 0,
                ) || []

              if (claimablePicks.length === 0) return null

              const totalWinnings = claimablePicks.reduce(
                (acc: number, p: any) => acc + (p.shares ?? 0),
                0,
              )

              const handleClaimAll = async () => {
                try {
                  const marketIds = claimablePicks.map((p: any) => p.marketId)
                  await redeemMultipleWinnings(marketIds, totalWinnings)
                  void refetchPvpStatus()
                } catch (err) {
                  console.error("Failed to claim all winnings", err)
                }
              }

              return (
                <div className="mb-4 p-4 rounded-xl bg-meadow-green/10 border border-meadow-green/20 flex flex-col md:flex-row items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <div>
                      <h4 className="text-sm font-bold text-meadow-green">
                        You have unclaimed winnings!
                      </h4>
                      <p className="text-xs text-ash mt-0.5">
                        Claim {totalWinnings.toFixed(2)} USDC from{" "}
                        {claimablePicks.length} winning{" "}
                        {claimablePicks.length === 1
                          ? "proposition"
                          : "propositions"}
                        .
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClaimAll}
                    className="px-4 py-2 rounded-[8px] bg-meadow-green hover:bg-meadow-green/90 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                  >
                    Claim All Winnings
                  </button>
                </div>
              )
            })()}

            <div className="space-y-3">
              {pvpStatus.ticket?.picks.map((pick: any) => {
                const childOpt = pvpStatus.event?.options.find(
                  (o: any) => o.id === pick.marketId,
                )
                const oppPick = pvpStatus.opponent?.picks.find(
                  (p: any) => p.marketId === pick.marketId,
                )

                const invested = pick.investedUsdc ?? 0

                return (
                  <div
                    key={pick.marketId}
                    className="flex flex-col gap-3 p-4 rounded-xl bg-parchment-card dark:bg-zinc-900/40 border border-border dark:border-zinc-800/85"
                  >
                    {/* Top row: Title + Shares */}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold tracking-wide text-charcoal-primary dark:text-zinc-200 uppercase truncate">
                        {(
                          childOpt?.optionName ||
                          pick.optionName ||
                          "Pick"
                        ).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-inter shrink-0">
                        Shares: <strong>{invested.toFixed(2)}</strong>
                      </span>
                    </div>

                    {/* Bottom row: Selections */}
                    <div className="grid grid-cols-2 md:flex md:items-stretch gap-2">
                      {/* Your Pick */}
                      <div className="flex flex-col items-start bg-white-surface dark:bg-zinc-950 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 flex-1 min-w-0">
                        <span className="text-[9px] font-inter text-ash uppercase">
                          You
                        </span>
                        <span className="text-xs font-semibold text-charcoal-primary dark:text-zinc-200 truncate max-w-full">
                          {pick.selection === "YES"
                            ? childOpt?.yesCondition || "YES"
                            : pick.selection === "NO"
                              ? childOpt?.noCondition || "NO"
                              : pick.selection}
                        </span>
                      </div>

                      {/* Opponent's Pick */}
                      <div className="flex flex-col items-start bg-white-surface dark:bg-zinc-950 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 flex-1 min-w-0">
                        <span className="text-[9px] font-inter text-ash uppercase">
                          Opponent
                        </span>
                        {pvpStatus.status === "queued" ? (
                          <span className="text-xs font-semibold text-ash italic animate-pulse">
                            Waiting...
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-charcoal-primary dark:text-zinc-200 truncate max-w-full">
                            {oppPick?.selection === "YES"
                              ? childOpt?.yesCondition || "YES"
                              : oppPick?.selection === "NO"
                                ? childOpt?.noCondition || "NO"
                                : oppPick?.selection}
                          </span>
                        )}
                      </div>

                      {/* Outcome — only shown when resolved */}
                      {(pick.status === "resolved" ||
                        pick.resolvedOutcome !== null) && (
                        <div className="flex flex-col items-start bg-zinc-100 dark:bg-zinc-900/60 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 flex-1 min-w-0">
                          <span className="text-[9px] font-inter text-ash uppercase">
                            Outcome
                          </span>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-full">
                            {pick.resolvedOutcome === "YES"
                              ? childOpt?.yesCondition || "YES"
                              : pick.resolvedOutcome === "NO"
                                ? childOpt?.noCondition || "NO"
                                : pick.resolvedOutcome}
                          </span>
                        </div>
                      )}

                      {/* Points — only shown when resolved */}
                      {pick.isCorrect !== null && (
                        <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 shrink-0">
                          <span className="text-[9px] font-inter text-ash uppercase">
                            Points
                          </span>
                          <span
                            className={`text-xs font-bold ${pick.isCorrect ? "text-meadow-green" : "text-charcoal-primary dark:text-zinc-400"}`}
                          >
                            {pick.isCorrect ? "+1 pt" : "0 pts"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Ticket Builder Form */}
      {(!hasActiveDuel || showBuilderOverride) &&
        (isEventEnded ? (
          <div className="verity-card p-8 text-center flex flex-col items-center justify-center gap-3">
            <span className="text-3xl">🔒</span>
            <h3 className="text-base font-bold text-charcoal-primary dark:text-white">
              Predictions are closed
            </h3>
            <p className="text-xs text-ash max-w-sm">
              The deadline for this event has passed or the event has been
              resolved. Please select another event from the dropdown to play.
            </p>
          </div>
        ) : (
          <div className="verity-card p-5 flex flex-col gap-4">
            <div className="border-b border-border dark:border-zinc-800 pb-3 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-charcoal-primary dark:text-white flex items-center gap-2">
                  Arena ticket builder
                </h3>
                <p className="text-xs text-ash mt-0.5">
                  Submit selections to queue for head-to-head matchup.
                </p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="p-1.5 rounded-full text-ash hover:text-charcoal-primary dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  aria-label="Rules Info"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
                {showTooltip && (
                  <div className="absolute right-0 top-9 z-50 w-72 p-4 rounded-xl bg-white dark:bg-zinc-950 border border-border dark:border-zinc-800 shadow-xl text-xs leading-relaxed text-charcoal-secondary dark:text-zinc-300 font-sans font-medium">
                    Each correct pick scores 1 point. Win: 100 Result XP, draw:
                    50, loss: 30. A perfect score adds 20 XP, and an active
                    boost applies 1.2x to the total.{" "}
                    <strong className="text-amber-600 dark:text-amber-400">
                      Note: You can select at most one prediction per category
                      group to build your ticket.
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {pvpEvents.length === 0 &&
              (() => {
                const claimablePicks =
                  pvpStatus?.ticket?.picks?.filter(
                    (p: any) => p.isCorrect === true && (p.shares ?? 0) > 0,
                  ) || []

                if (claimablePicks.length > 0) {
                  const totalWinnings = claimablePicks.reduce(
                    (acc: number, p: any) => acc + (p.shares ?? 0),
                    0,
                  )

                  const handleClaimAll = async () => {
                    try {
                      const marketIds = claimablePicks.map(
                        (p: any) => p.marketId,
                      )
                      await redeemMultipleWinnings(marketIds, totalWinnings)
                      void refetchPvpStatus()
                    } catch (err) {
                      console.error("Failed to claim all winnings", err)
                    }
                  }

                  return (
                    <div className="p-4 rounded-xl bg-meadow-green/10 border border-meadow-green/20 flex flex-col md:flex-row items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-meadow-green font-sans">
                            You have unclaimed winnings from your last duel!
                          </h4>
                          <p className="text-xs text-ash mt-0.5 font-medium font-sans">
                            Claim {totalWinnings.toFixed(2)} USDC from{" "}
                            {claimablePicks.length} winning{" "}
                            {claimablePicks.length === 1
                              ? "proposition"
                              : "propositions"}
                            .
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleClaimAll}
                        className="px-4 py-2 rounded-[8px] bg-meadow-green hover:bg-meadow-green/90 text-white text-xs font-bold transition-all shadow-sm shrink-0 font-sans cursor-pointer"
                      >
                        Claim All Winnings
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="p-8 text-center text-sm text-ash border border-dashed border-border dark:border-zinc-800 rounded-[12px] bg-parchment-card dark:bg-zinc-950/20">
                    No active PvP events right now. Check back soon for new
                    matchups!
                  </div>
                )
              })()}

            {pvpEvents.length > 0 && selectedPvpEvent && (
              <div className="flex flex-col gap-4">
                {/* Category Cards */}
                <div className="space-y-3 mt-2">
                  {Object.entries(groupedOptions).map(([groupKey, opts]) => {
                    const firstOpt = opts[0]
                    const isMulti =
                      firstOpt?.outcomeCount && firstOpt.outcomeCount > 2
                    const groupVolume = opts.reduce(
                      (s: number, o: any) => s + Number(o.liquidity ?? 0),
                      0,
                    )

                    // Determine category metadata
                    const catMeta = getCategoryMeta(groupKey)

                    // Extract handicap line from outcomes if O/U
                    let handicapLine: string | null = null
                    if (!isMulti && opts.length === 1) {
                      const yc = firstOpt.yesCondition || ""
                      const numMatch = yc.match(/(\d+(?:\.\d+)?)/)
                      if (numMatch) handicapLine = numMatch[1]
                    }

                    // Check if any option in this group has a selection
                    const hasSelection = opts.some(
                      (o: any) => pvpSelections[o.id],
                    )

                    // Determine highlight color based on active selection: Draw = amber, other = emerald
                    let selectedOptionColor: string | null = null
                    if (hasSelection) {
                      if (isMulti) {
                        const selection = pvpSelections[firstOpt.id]
                        if (selection) {
                          const isDrawOption =
                            selection.toLowerCase().includes("draw") ||
                            selection.toLowerCase().includes("no goal") ||
                            selection.toLowerCase().includes("equal")
                          selectedOptionColor = isDrawOption
                            ? "amber"
                            : "emerald"
                        }
                      } else {
                        // Binary market
                        selectedOptionColor = "emerald"
                      }
                    }

                    return (
                      <ArenaCategory
                        key={groupKey}
                        title={catMeta.title}
                        subtitle={
                          handicapLine
                            ? `Over / Under ${handicapLine}`
                            : catMeta.subtitle
                        }
                        icon={catMeta.icon}
                        accentColor={selectedOptionColor || catMeta.accent}
                        volume={groupVolume}
                        hasSelection={hasSelection}
                        onAddLiquidity={() => setLiquidityMarketId(firstOpt.id)}
                      >
                        {isMulti ? (
                          /* 3-way (or N-way) market — show clean outcome names */
                          <div
                            className={`grid gap-2 ${firstOpt.outcomeCount === 3 ? "grid-cols-3" : firstOpt.outcomeCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}
                          >
                            {firstOpt.outcomes.map(
                              (outcomeName: string, idx: number) => {
                                const price =
                                  firstOpt.outcomePrices?.[idx] ??
                                  1 / firstOpt.outcomeCount
                                const priceCents = (price * 100).toFixed(1)
                                const isSelected =
                                  pvpSelections[firstOpt.id] === outcomeName
                                const displayName = cleanOutcomeName(
                                  outcomeName,
                                  parsedTeams.teamA,
                                  parsedTeams.teamB,
                                )

                                // Pick accent colors for 3-way: home / draw / away
                                const isHome = idx === 0
                                const isDrawOption =
                                  displayName.toLowerCase().includes("draw") ||
                                  displayName
                                    .toLowerCase()
                                    .includes("no goal") ||
                                  displayName.toLowerCase().includes("equal")
                                const btnColor = isSelected
                                  ? isDrawOption
                                    ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-400/30"
                                    : "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/30"
                                  : "bg-stone-50/50 dark:bg-zinc-900/20 text-stone-600 dark:text-zinc-400 border border-stone-200/80 dark:border-zinc-800/60 hover:bg-stone-100/60 dark:hover:bg-zinc-800/40"

                                return (
                                  <button
                                    key={outcomeName}
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      handleToggleSelection(
                                        firstOpt.id,
                                        outcomeName,
                                      )
                                    }
                                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl cursor-pointer transition-all ${btnColor} disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {/* <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                                    {isHome ? "Home" : isDraw ? "Draw" : "Away"}
                                  </span> */}
                                    <span className="text-sm font-bold text-center leading-tight">
                                      {displayName}
                                    </span>
                                    <span className="text-[10px] font-mono mt-0.5 opacity-70">
                                      {priceCents}¢
                                    </span>
                                  </button>
                                )
                              },
                            )}
                          </div>
                        ) : (
                          /* Binary O/U market */
                          (() => {
                            const opt = firstOpt
                            const yesPool = Number(opt.usdcYesAmount ?? 0)
                            const noPool = Number(opt.usdcNoAmount ?? 0)
                            const totalPool = yesPool + noPool
                            let yesProb = 50
                            if (totalPool > 0)
                              yesProb = (yesPool / totalPool) * 100
                            const noProb = 100 - yesProb
                            const yesLabel = cleanOutcomeName(
                              opt.yesCondition || "Yes",
                              parsedTeams.teamA,
                              parsedTeams.teamB,
                            )
                            const noLabel = cleanOutcomeName(
                              opt.noCondition || "No",
                              parsedTeams.teamA,
                              parsedTeams.teamB,
                            )

                            return (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSelection(opt.id, "YES")
                                  }
                                  disabled={isSubmitting}
                                  className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    pvpSelections[opt.id] === "YES"
                                      ? `${catMeta.selectedBg} text-white shadow-md ring-2 ${catMeta.ring}`
                                      : `${catMeta.unselectedBg} hover:opacity-80`
                                  }`}
                                >
                                  <span className="text-sm font-bold">
                                    {yesLabel}
                                  </span>
                                  <span className="text-[10px] font-mono opacity-70">
                                    {yesProb.toFixed(1)}¢
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSelection(opt.id, "NO")
                                  }
                                  disabled={isSubmitting}
                                  className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                    pvpSelections[opt.id] === "NO"
                                      ? `${catMeta.selectedBg} text-white shadow-md ring-2 ${catMeta.ring}`
                                      : `${catMeta.unselectedBg} hover:opacity-80`
                                  }`}
                                >
                                  <span className="text-sm font-bold">
                                    {noLabel}
                                  </span>
                                  <span className="text-[10px] font-mono opacity-70">
                                    {noProb.toFixed(1)}¢
                                  </span>
                                </button>
                              </div>
                            )
                          })()
                        )}
                      </ArenaCategory>
                    )
                  })}
                </div>

                {/* Selection Summary */}
                {Object.keys(pvpSelections).length > 0 && (
                  <div className="rounded-xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-3 mt-2">
                    <span className="block text-[10px] font-bold uppercase text-ash tracking-wider mb-1.5">
                      Your Picks — {Object.keys(pvpSelections).length}{" "}
                      selections
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(pvpSelections).map(
                        ([optId, selection]) => {
                          const opt = selectedPvpEvent.options.find(
                            (o: any) => o.id === optId,
                          )
                          const isMultiOpt =
                            opt?.outcomeCount && opt.outcomeCount > 2
                          const displaySelection = isMultiOpt
                            ? cleanOutcomeName(
                                selection,
                                parsedTeams.teamA,
                                parsedTeams.teamB,
                              )
                            : selection === "YES"
                              ? cleanOutcomeName(
                                  opt?.yesCondition || "Yes",
                                  parsedTeams.teamA,
                                  parsedTeams.teamB,
                                )
                              : cleanOutcomeName(
                                  opt?.noCondition || "No",
                                  parsedTeams.teamA,
                                  parsedTeams.teamB,
                                )
                          return (
                            <span
                              key={optId}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {opt?.optionName}: {displaySelection}
                            </span>
                          )
                        },
                      )}
                    </div>
                  </div>
                )}

                {/* Bet amount settings */}
                <div className="flex flex-col gap-3 bg-stone-100/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-border/60 dark:border-zinc-800/40 mt-4 mb-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-mono font-bold text-ash uppercase block">
                        Bet Amount per selection
                      </span>
                      <span className="text-[10px] text-ash">
                        Each selected option will be purchased for this amount.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={betAmountPerSelection}
                        disabled={isSubmitting}
                        onChange={(e) =>
                          setBetAmountPerSelection(
                            Math.max(1, Number(e.target.value)),
                          )
                        }
                        className="w-20 h-9 px-2 border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 text-xs font-bold font-mono rounded-md text-charcoal-primary dark:text-white outline-none focus:border-indigo-500 text-right disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-mono font-bold text-charcoal-primary dark:text-zinc-400">
                        USDC
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed border-border/60 dark:border-zinc-800/60 pt-2.5 mt-1">
                    <span className="text-xs font-mono text-ash font-bold uppercase">
                      Total Ticket Cost ({Object.keys(pvpSelections).length}{" "}
                      Selections)
                    </span>
                    <strong className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                      {betAmountPerSelection *
                        Object.keys(pvpSelections).length}{" "}
                      USDC
                    </strong>
                  </div>
                </div>

                {/* XP boost indicator and submit button */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-t border-border dark:border-zinc-800 pt-4 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-ash">
                      Boosts Remaining:{" "}
                      <strong className="text-charcoal-primary dark:text-white">
                        {referralsData?.doubleBoostRemaining ?? 0}
                      </strong>
                      {referralsData &&
                        referralsData.doubleBoostRemaining > 0 &&
                        " (Auto-active 1.2x XP)"}
                    </span>
                  </div>

                  <button
                    onClick={handleSubmitPvpTicket}
                    disabled={
                      isSubmitting || Object.keys(pvpSelections).length < 3
                    }
                    className="verity-pill px-6 h-11 bg-indigo-600 text-white hover:bg-indigo-500 font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : Object.keys(pvpSelections).length < 3
                        ? `Select ${3 - Object.keys(pvpSelections).length} More Categories`
                        : "Submit ticket & Queue"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Claim Winnings Banner at bottom */}
                {(() => {
                  const claimablePicks =
                    pvpStatus?.ticket?.picks?.filter(
                      (p: any) => p.isCorrect === true && (p.shares ?? 0) > 0,
                    ) || []

                  if (claimablePicks.length === 0) return null

                  const totalWinnings = claimablePicks.reduce(
                    (acc: number, p: any) => acc + (p.shares ?? 0),
                    0,
                  )

                  const handleClaimAll = async () => {
                    try {
                      const marketIds = claimablePicks.map(
                        (p: any) => p.marketId,
                      )
                      await redeemMultipleWinnings(marketIds, totalWinnings)
                      void refetchPvpStatus()
                    } catch (err) {
                      console.error("Failed to claim all winnings", err)
                    }
                  }

                  return (
                    <div className="p-4 rounded-xl bg-meadow-green/10 border border-meadow-green/20 flex flex-col md:flex-row items-center justify-between gap-3 text-left mt-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-meadow-green font-sans">
                            You have unclaimed winnings from your last duel!
                          </h4>
                          <p className="text-xs text-ash mt-0.5 font-medium font-sans">
                            Claim {totalWinnings.toFixed(2)} USDC from{" "}
                            {claimablePicks.length} winning{" "}
                            {claimablePicks.length === 1
                              ? "proposition"
                              : "propositions"}
                            .
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleClaimAll}
                        className="px-4 py-2 rounded-[8px] bg-meadow-green hover:bg-meadow-green/90 text-white text-xs font-bold transition-all shadow-sm shrink-0 font-sans cursor-pointer"
                      >
                        Claim All Winnings
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        ))}

      {/* Pvp Child Market Add Liquidity Modal */}
      <PvpLiquidityModal
        liquidityMarketId={liquidityMarketId}
        setLiquidityMarketId={setLiquidityMarketId}
        optionForLP={optionForLP}
        selectedPvpEvent={selectedPvpEvent}
        refetchPvpStatus={refetchPvpStatus}
        profile={profile}
      />
    </div>
  )
}

/* ──────────────────────────────────────────────
   Category metadata helper
   ────────────────────────────────────────────── */
interface CatMeta {
  title: string
  subtitle: string
  icon: React.ReactNode
  accent: string
  selectedBg: string
  ring: string
  unselectedBg: string
}

function getCategoryMeta(groupKey: string): CatMeta {
  const map: Record<string, CatMeta> = {
    major: {
      title: "Match Winner",
      subtitle: "3-way: Win / Draw / Win",
      icon: <Trophy className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40",
    },
    match_winner: {
      title: "Match Winner",
      subtitle: "3-way: Win / Draw / Win",
      icon: <Trophy className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40",
    },
    first_goal: {
      title: "First Team to Score",
      subtitle: "First to Score",
      icon: <Target className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40",
    },
    red_card: {
      title: "Red Card",
      subtitle: "Red card shown in match",
      icon: <RectangleVertical className="h-4 w-4 fill-current rotate-12" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/40",
    },
    red_cards: {
      title: "Red Card",
      subtitle: "Red card shown in match",
      icon: <RectangleVertical className="h-4 w-4 fill-current rotate-12" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-red-50/80 dark:bg-red-950/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-900/40",
    },
    corners: {
      title: "Corners",
      subtitle: "Over / Under",
      icon: <Flag className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40",
    },
    total_corners: {
      title: "Corners",
      subtitle: "Over / Under",
      icon: <Flag className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40",
    },
    goals: {
      title: "Goals",
      subtitle: "Over / Under",
      icon: <Target className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-amber-50/80 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40",
    },
    total_goals: {
      title: "Goals",
      subtitle: "Over / Under",
      icon: <Target className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-amber-50/80 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/40",
    },
    cards: {
      title: "Yellow Cards",
      subtitle: "Over / Under",
      icon: <RectangleVertical className="h-4 w-4 fill-current rotate-12" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-yellow-50/80 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-900/40",
    },
    yellow_cards: {
      title: "Yellow Cards",
      subtitle: "Over / Under",
      icon: <RectangleVertical className="h-4 w-4 fill-current rotate-12" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-yellow-50/80 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-900/40",
    },
    total_yellow_cards: {
      title: "Yellow Cards",
      subtitle: "Over / Under",
      icon: <RectangleVertical className="h-4 w-4 fill-current rotate-12" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-yellow-50/80 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border border-yellow-100 dark:border-yellow-900/40",
    },
  }

  const fallback: CatMeta = {
    title: groupKey
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    subtitle: "Proposition",
    icon: <Swords className="h-4 w-4" />,
    accent: "emerald",
    selectedBg: "bg-emerald-600",
    ring: "ring-emerald-400/30",
    unselectedBg:
      "bg-stone-100/80 dark:bg-zinc-800/40 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700/60",
  }

  const meta = map[groupKey] || fallback
  return {
    ...meta,
    unselectedBg:
      "bg-stone-50/50 dark:bg-zinc-900/20 text-stone-600 dark:text-zinc-400 border border-stone-200/80 dark:border-zinc-800/60 hover:bg-stone-100/60 dark:hover:bg-zinc-800/40",
  }
}

/* ──────────────────────────────────────────────
   ArenaCategory — visual card for each group
   ────────────────────────────────────────────── */
function ArenaCategory({
  title,
  subtitle,
  icon,
  accentColor,
  volume,
  hasSelection,
  onAddLiquidity,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  accentColor: string
  volume: number
  hasSelection: boolean
  onAddLiquidity: () => void
  children: React.ReactNode
}) {
  const accentMap: Record<
    string,
    { bg: string; border: string; iconBg: string; iconActive: string }
  > = {
    indigo: {
      bg: "bg-indigo-50/30 dark:bg-indigo-950/10",
      border: "border-indigo-200 dark:border-indigo-900/50",
      iconBg:
        "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
      iconActive: "bg-indigo-600 text-white",
    },
    emerald: {
      bg: "bg-emerald-50/30 dark:bg-emerald-950/10",
      border: "border-emerald-200 dark:border-emerald-900/50",
      iconBg:
        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
      iconActive: "bg-emerald-600 text-white",
    },
    amber: {
      bg: "bg-amber-50/30 dark:bg-amber-950/10",
      border: "border-amber-200 dark:border-amber-900/50",
      iconBg:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
      iconActive: "bg-amber-500 text-white",
    },
    yellow: {
      bg: "bg-yellow-50/30 dark:bg-yellow-950/10",
      border: "border-yellow-200 dark:border-yellow-900/50",
      iconBg:
        "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
      iconActive: "bg-yellow-500 text-white",
    },
    stone: {
      bg: "bg-stone-50/30 dark:bg-zinc-900/20",
      border: "border-stone-200 dark:border-zinc-700/60",
      iconBg: "bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400",
      iconActive: "bg-stone-600 text-white",
    },
  }

  const colors = accentMap[accentColor] || accentMap.stone

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        hasSelection
          ? `${colors.bg} ${colors.border}`
          : "border-border dark:border-zinc-800 bg-white dark:bg-zinc-900/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              hasSelection ? colors.iconActive : colors.iconBg
            }`}
          >
            {icon}
          </div>
          <div className="text-left min-w-0">
            <span className="block text-sm font-bold text-charcoal-primary dark:text-white leading-tight">
              {title}
            </span>
            <span className="block text-[10px] text-ash font-mono truncate">
              {subtitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-ash font-mono">
            ${volume.toLocaleString()} Vol.
          </span>
          <button
            type="button"
            onClick={onAddLiquidity}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-border dark:border-zinc-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-stone-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer shadow-xs bg-stone-50/50 dark:bg-zinc-900/20"
          >
            + LP
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 pb-3">{children}</div>
    </div>
  )
}
