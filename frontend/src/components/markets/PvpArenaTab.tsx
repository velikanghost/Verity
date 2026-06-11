"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/components/providers/AuthModals"
import { useMarketResolution } from "@/hooks/useMarketResolution"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { arcUsdcAddress, FPMM_ADDRESS, publicClient } from "@/lib/arc"
import {
  useSubmitPvpTicketMutation,
  useExecuteMarketTradeMutation,
} from "@/store/verity/verityQueries"
import { toast } from "@/lib/toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Sub-components
import PvpArenaSkeleton from "./PvpArenaSkeleton"
import PvpDuelStatus from "./PvpDuelStatus"
import PvpDuelPicks from "./PvpDuelPicks"
import PvpTicketBuilder from "./PvpTicketBuilder"
import PvpLiquidityModal from "./PvpLiquidityModal"

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "")
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`
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

  // ─── Local state ────────────────────────────────────────────
  const [mounted, setMounted] = useState<boolean>(false)
  const [showBuilderOverride, setShowBuilderOverride] = useState<boolean>(false)
  const [betAmountPerSelection, setBetAmountPerSelection] = useState<number>(5)
  const [pvpSelections, setPvpSelections] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [showTooltip, setShowTooltip] = useState<boolean>(false)
  const [claimedMarketIds, setClaimedMarketIds] = useState<Set<string>>(
    new Set(),
  )
  const [liquidityMarketId, setLiquidityMarketId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // ─── Derived data ───────────────────────────────────────────
  const selectedPvpEvent = useMemo(() => {
    if (!pvpEvents || pvpEvents.length === 0) return null
    if (selectedPvpEventId) {
      return (
        pvpEvents.find((e: any) => e.id === selectedPvpEventId) || pvpEvents[0]
      )
    }
    return pvpEvents[0]
  }, [pvpEvents, selectedPvpEventId])

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

  const parsedTeams = useMemo(() => {
    if (!selectedPvpEvent?.question) return { teamA: "Team A", teamB: "Team B" }
    const vsMatch = selectedPvpEvent.question.match(/(.+?)\s+vs\.?\s+(.+)/i)
    if (vsMatch) return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() }
    const dashMatch = selectedPvpEvent.question.match(/(.+?)\s+-\s+(.+)/)
    if (dashMatch)
      return { teamA: dashMatch[1].trim(), teamB: dashMatch[2].trim() }
    return { teamA: "Team A", teamB: "Team B" }
  }, [selectedPvpEvent])

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

  const hasActiveDuel =
    pvpStatus?.status === "queued" ||
    pvpStatus?.status === "matched" ||
    pvpStatus?.status === "resolved"

  const isEventEnded =
    selectedPvpEvent &&
    (new Date() >= new Date(selectedPvpEvent.deadline) ||
      selectedPvpEvent.status === "resolved")

  // ─── Effects ────────────────────────────────────────────────

  // Reset selections when event changes
  useEffect(() => {
    if (selectedPvpEvent) {
      setPvpSelections({})
      setShowBuilderOverride(false)
    }
  }, [selectedPvpEvent])

  // ─── Handlers ───────────────────────────────────────────────

  const handleToggleSelection = useCallback(
    (optId: string, selection: string) => {
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
    },
    [selectedPvpEvent],
  )

  const handleClaim = useCallback(
    async (marketIds: string[], totalWinnings: number) => {
      try {
        await redeemMultipleWinnings(marketIds, totalWinnings)
        setClaimedMarketIds((prev) => {
          const next = new Set(prev)
          marketIds.forEach((id) => next.add(id))
          return next
        })
        void refetchPvpStatus()
      } catch (err) {
        console.error("Failed to claim all winnings", err)
      }
    },
    [redeemMultipleWinnings, refetchPvpStatus],
  )

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

      return { marketId, selection, shares }
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

  // ─── Loading state ──────────────────────────────────────────
  const isPvpStatusPending =
    !!profile &&
    !!selectedPvpEventId &&
    (!pvpStatus || pvpStatus?.event?.id !== selectedPvpEventId) &&
    pvpStatusLoading

  if (!mounted || pvpEventsLoading || pvpStatusLoading || isPvpStatusPending) {
    return (
      <PvpArenaSkeleton optionCount={selectedPvpEvent?.options?.length || 5} />
    )
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="lg:col-span-2 flex flex-col gap-4">
      {/* Event Selector Header Card */}
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

      {/* Active Duel View */}
      {hasActiveDuel && !showBuilderOverride && (
        <div className="flex flex-col gap-4">
          <PvpDuelStatus
            status={pvpStatus.status}
            pvpStatus={pvpStatus}
            runningScoreUser={runningScoreUser}
            runningScoreOpponent={runningScoreOpponent}
          />
          <PvpDuelPicks
            pvpStatus={pvpStatus}
            claimedMarketIds={claimedMarketIds}
            onClaim={handleClaim}
          />
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
          <PvpTicketBuilder
            selectedPvpEvent={selectedPvpEvent}
            pvpEvents={pvpEvents}
            pvpStatus={pvpStatus}
            pvpSelections={pvpSelections}
            betAmountPerSelection={betAmountPerSelection}
            isSubmitting={isSubmitting}
            showTooltip={showTooltip}
            claimedMarketIds={claimedMarketIds}
            referralsData={referralsData}
            parsedTeams={parsedTeams}
            groupedOptions={groupedOptions}
            onToggleSelection={handleToggleSelection}
            onSetBetAmount={setBetAmountPerSelection}
            onSetShowTooltip={setShowTooltip}
            onSubmitTicket={handleSubmitPvpTicket}
            onClaim={handleClaim}
            onAddLiquidity={(id) => setLiquidityMarketId(id)}
          />
        ))}

      {/* Liquidity Modal */}
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
