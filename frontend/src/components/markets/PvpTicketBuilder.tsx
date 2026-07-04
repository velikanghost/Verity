"use client"

import { useMemo, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import { HelpCircle, ChevronRight, Check, Receipt, X } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import ArenaCategory, { getCategoryMeta } from "./PvpArenaCategory"
import { getCountryFlag } from "./PvpMatchupCarousel"

export const cleanOutcomeName = (
  name: string,
  teamA: string,
  teamB: string,
) => {
  const lowerName = name.toLowerCase().trim()
  const lowerA = teamA.toLowerCase().trim()
  const lowerB = teamB.toLowerCase().trim()

  if (
    lowerName.includes("wins on penalties") ||
    lowerName.includes("wins shootout")
  ) {
    if (lowerName.includes(lowerA)) return teamA
    if (lowerName.includes(lowerB)) return teamB
  }

  if (lowerName === "no penalties" || lowerName.includes("no penalties")) {
    return "No Penalty"
  }

  if (
    lowerName === "both teams to score - yes" ||
    lowerName === "both teams to score-yes" ||
    lowerName === "btts - yes" ||
    lowerName === "btts-yes"
  ) {
    return "YES"
  }

  if (
    lowerName === "both teams to score - no" ||
    lowerName === "both teams to score-no" ||
    lowerName === "btts - no" ||
    lowerName === "btts-no"
  ) {
    return "NO"
  }

  if (
    lowerName === "match ends in a draw" ||
    lowerName === "match ends with equal corners" ||
    lowerName === "match ends with equal yellow cards" ||
    lowerName === "match ends with equal fouls" ||
    lowerName === "draw"
  ) {
    return "Draw"
  }

  if (lowerName === "no goal in the match" || lowerName === "no goal") {
    return "No Goal"
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
    .replace(/\s+scores\s+first/i, "")
    .replace(/\s+leads\s+at\s+halftime/i, "")
    .replace(/\s+keeps\s+a\s+clean\s+sheet/i, "")
    .replace(/\s+commits\s+more\s+fouls/i, "")
    .trim()

  return cleaned
}

interface PvpTicketBuilderProps {
  selectedPvpEvent: any
  pvpEvents: any[]
  pvpStatus: any
  pvpSelections: Record<string, string>
  betAmountPerSelection: number
  isSubmitting: boolean
  showTooltip: boolean
  referralsData: any
  parsedTeams: { teamA: string; teamB: string }
  groupedOptions: Record<string, any[]>
  onToggleSelection: (optId: string, selection: string) => void
  onSetBetAmount: (amount: number) => void
  onSetShowTooltip: (show: boolean) => void
  onSubmitTicket: (couponCode?: string) => void
  onProvideLiquidity: (amounts: Record<string, number>) => Promise<void>
  onAddLiquidity: (marketId: string) => void
}

export default function PvpTicketBuilder({
  selectedPvpEvent,
  pvpEvents,
  pvpStatus,
  pvpSelections,
  betAmountPerSelection,
  isSubmitting,
  showTooltip,
  referralsData,
  parsedTeams,
  groupedOptions,
  onToggleSelection,
  onSetBetAmount,
  onSetShowTooltip,
  onSubmitTicket,
  onProvideLiquidity,
  onAddLiquidity,
}: PvpTicketBuilderProps) {
  const selectionCount = Object.keys(pvpSelections).length
  const { rawBalance, formattedBalance } = useUsdcBalance()

  const activeBoostsList = referralsData?.activeBoosts || []
  const downtimeBoostRemaining = activeBoostsList
    .filter((b: any) => b.source === "downtime")
    .reduce((sum: number, b: any) => sum + (b.matchesRemaining || 0), 0)
  const missionBoostRemaining = activeBoostsList
    .filter((b: any) => b.source === "mission")
    .reduce((sum: number, b: any) => sum + (b.matchesRemaining || 0), 0)
  const doubleBoostRemaining = activeBoostsList
    .filter((b: any) => b.source === "referral")
    .reduce((sum: number, b: any) => sum + (b.matchesRemaining || 0), 0)

  // Coupon state
  const [couponCode, setCouponCode] = useState("")
  const [couponMultiplier, setCouponMultiplier] = useState<number | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"single" | "liquidity">("single")
  const [liquidityAmounts, setLiquidityAmounts] = useState<
    Record<string, string>
  >({})
  const [liquidityPerSelection, setLiquidityPerSelection] = useState<number>(0)

  useEffect(() => {
    if (liquidityPerSelection > 0) {
      setLiquidityAmounts((prev) => {
        const next = { ...prev }
        let changed = false
        Object.keys(pvpSelections).forEach((optId) => {
          if (!next[optId]) {
            next[optId] = liquidityPerSelection.toString()
            changed = true
          }
        })
        return changed ? next : prev
      })
    }
  }, [pvpSelections, liquidityPerSelection])

  useEffect(() => {
    const code = couponCode.trim()
    if (!code) {
      setCouponMultiplier(null)
      setCouponError(null)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{ success: boolean; multiplier: number }>(
          `/coupons/validate/${code}`,
        )
        setCouponMultiplier(res.multiplier)
        setCouponError(null)
      } catch (err: any) {
        setCouponMultiplier(null)
        setCouponError(err.message || "Invalid coupon")
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [couponCode])

  const totalVolume = useMemo(() => {
    if (!selectedPvpEvent?.options) return 0
    return selectedPvpEvent.options.reduce(
      (sum: number, opt: any) => sum + Number(opt.liquidity ?? 0),
      0,
    )
  }, [selectedPvpEvent])

  const formattedDate = useMemo(() => {
    const timeStr = selectedPvpEvent?.lockTime || selectedPvpEvent?.deadline
    if (!timeStr) return ""
    const date = new Date(timeStr)
    const month = date.toLocaleDateString(undefined, {
      month: "short",
    })
    const day = date.toLocaleDateString(undefined, {
      day: "numeric",
    })
    const time = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    return `${month} ${day}, ${time}`
  }, [selectedPvpEvent])

  const progressPercent = Math.min((selectionCount / 3) * 100, 100)

  const handleLiquidityAmountChange = (optId: string, value: string) => {
    setLiquidityAmounts((prev) => ({
      ...prev,
      [optId]: value,
    }))
  }

  const handleProvideLiquiditySubmit = async () => {
    let totalLiquidity = 0
    const validAmounts: Record<string, number> = {}
    for (const [optId, amtStr] of Object.entries(liquidityAmounts)) {
      const amt = parseFloat(amtStr)
      if (!isNaN(amt) && amt > 0) {
        validAmounts[optId] = amt
        totalLiquidity += amt
      }
    }

    const rawTotalLiquidity = BigInt(Math.round(totalLiquidity * 1e6))
    if (rawTotalLiquidity > (rawBalance || BigInt(0))) {
      toast.error(
        `Insufficient USDC balance. You need at least ${totalLiquidity} USDC, but your balance is ${(Number(rawBalance || 0) / 1e6).toFixed(2)} USDC.`,
      )
      return
    }

    setIsMobileDrawerOpen(false)
    try {
      await onProvideLiquidity(validAmounts)
      setLiquidityAmounts({})
    } catch (error) {
      // Allow user to manually re-open with their inputs intact on failure
    }
  }

  const renderTicketSlip = () => {
    const totalLiquidity = Object.values(liquidityAmounts).reduce(
      (sum, amtStr) => {
        const amt = parseFloat(amtStr)
        return sum + (isNaN(amt) ? 0 : amt)
      },
      0,
    )

    return (
      <div className="flex flex-col gap-0 w-full h-full min-h-0 max-h-full">
        {/* Custom Tabs */}
        <div className="flex items-center w-full p-1 mb-4 rounded-lg bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => setActiveTab("single")}
            className={`flex-1 py-1.5 text-xs font-bold font-mono tracking-wider rounded-md transition-colors ${
              activeTab === "single"
                ? "bg-white dark:bg-zinc-800 text-charcoal-primary dark:text-white shadow-sm"
                : "text-ash hover:text-charcoal-primary dark:hover:text-zinc-300 hover:bg-stone-200 dark:hover:bg-zinc-800/50"
            }`}
          >
            Single
          </button>
          <button
            onClick={() => setActiveTab("liquidity")}
            className={`flex-1 py-1.5 text-xs font-bold font-mono tracking-wider rounded-md transition-colors ${
              activeTab === "liquidity"
                ? "bg-white dark:bg-zinc-800 text-charcoal-primary dark:text-white shadow-sm"
                : "text-ash hover:text-charcoal-primary dark:hover:text-zinc-300 hover:bg-stone-200 dark:hover:bg-zinc-800/50"
            }`}
          >
            Liquidity
          </button>
        </div>

        {/* Selection Summary */}
        <div className="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0 pr-1 pb-4">
          {selectionCount === 0 && (
            <div className="text-center py-6 text-ash text-xs font-medium">
              No picks selected yet.
            </div>
          )}
          {Object.entries(pvpSelections).map(([optId, selection]) => {
            const opt = selectedPvpEvent?.options?.find(
              (o: any) => o.id === optId,
            )
            const isMultiOpt = opt?.outcomeCount && opt.outcomeCount > 2
            let displaySelection = isMultiOpt
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
            if (
              opt &&
              (opt.optionGroup === "red_card" ||
                opt.optionGroup === "red_cards")
            ) {
              displaySelection =
                selection === "YES" ? "Red card shown" : "No red card"
            }

            return (
              <div
                key={optId}
                className="flex flex-col gap-2 p-3 bg-stone-100 dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => onToggleSelection(optId, selection)}
                    className="p-1 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded text-ash hover:text-red-500 transition-colors mt-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-1.5 text-sm font-bold text-charcoal-primary dark:text-white truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0">⚽</span>
                          <span className="truncate">{displaySelection}</span>
                        </div>
                        <div className="text-xs text-ash truncate">
                          {selectedPvpEvent?.question}
                        </div>
                        <div className="text-[10px] font-mono text-ash/70 uppercase tracking-wider">
                          {opt?.optionGroup?.replace(/_/g, " ") || "Option"}
                        </div>
                      </div>
                      <div className="">
                        {/* Odds representation */}
                        <div className="text-sm text-right font-mono font-bold text-ash/80">
                          {opt?.poolA && opt?.poolB
                            ? (
                                (opt.poolA + opt.poolB) /
                                (selection === "YES" ? opt.poolA : opt.poolB)
                              ).toFixed(2)
                            : "2.00"}
                        </div>

                        {activeTab === "liquidity" && (
                          <div className="mt-2 pt-2 flex justify-end">
                            <div className="flex items-center gap-2 w-32">
                              <Input
                                type="number"
                                min="1"
                                placeholder="USDC"
                                value={liquidityAmounts[optId] || ""}
                                onChange={(e) =>
                                  handleLiquidityAmountChange(
                                    optId,
                                    e.target.value,
                                  )
                                }
                                className="h-8 text-xs font-mono bg-white dark:bg-black border-stone-300 dark:border-zinc-700 text-right"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom Actions */}
        <div className="mt-4 pt-4 border-t border-stone-200 dark:border-zinc-800 bg-warm-canvas pb-2 shrink-0">
          {activeTab === "single" ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ash uppercase">
                  Stake per bet
                </span>
                <div className="flex items-center gap-2 w-32">
                  <span className="text-xs font-bold text-ash">USDC</span>
                  <Input
                    type="number"
                    min="1"
                    value={
                      betAmountPerSelection === 0 ? "" : betAmountPerSelection
                    }
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const val = e.target.value
                      onSetBetAmount(val === "" ? 0 : Number(val))
                    }}
                    className="h-9 text-xs font-bold font-mono bg-stone-100 dark:bg-zinc-900 border-stone-300 dark:border-zinc-700 text-right"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal-primary dark:text-white">
                  Total Stake
                </span>
                <span className="text-sm font-bold font-mono text-charcoal-primary dark:text-white">
                  {betAmountPerSelection * selectionCount} USDC
                </span>
              </div>

              {/* Coupon input hidden to match cleaner UI, or could be placed under an advanced toggle */}

              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false)
                  onSubmitTicket()
                }}
                disabled={isSubmitting || selectionCount < 3}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm shadow-md transition-all rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting
                  ? "Submitting..."
                  : selectionCount < 3
                    ? `Select ${3 - selectionCount} More Categories`
                    : "Place Bet"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ash uppercase">
                  Liquidity per market
                </span>
                <div className="flex items-center gap-2 w-32">
                  <span className="text-xs font-bold text-ash">USDC</span>
                  <Input
                    type="number"
                    min="1"
                    value={
                      liquidityPerSelection === 0 ? "" : liquidityPerSelection
                    }
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const val = e.target.value
                      const num = parseFloat(val)
                      setLiquidityPerSelection(isNaN(num) ? 0 : num)
                      
                      const newAmounts = { ...liquidityAmounts }
                      Object.keys(pvpSelections).forEach((optId) => {
                        newAmounts[optId] = val
                      })
                      setLiquidityAmounts(newAmounts)
                    }}
                    className="h-8 text-right font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal-primary dark:text-white">
                  Total Liquidity
                </span>
                <span className="text-sm font-bold font-mono text-charcoal-primary dark:text-white">
                  {totalLiquidity} USDC
                </span>
              </div>
              <button
                onClick={handleProvideLiquiditySubmit}
                disabled={isSubmitting || totalLiquidity <= 0}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-wider text-sm shadow-md transition-all rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? "Providing Liquidity..." : "Provide Liquidity"}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 w-full pb-20 relative">
      {/* 1. Match Header Details */}
      {selectedPvpEvent && (
        <div className="flex flex-col gap-1 pb-1">
          <div className="flex items-center gap-2.5 text-2xl font-black text-charcoal-primary dark:text-white">
            <span className="text-3xl select-none">
              {getCountryFlag(parsedTeams.teamA)}
            </span>
            <span className="text-sm font-semibold opacity-40 font-mono">
              vs
            </span>
            <span className="text-3xl select-none">
              {getCountryFlag(parsedTeams.teamB)}
            </span>
            <h1 className="font-sans ml-1.5 leading-none">
              {parsedTeams.teamA} vs {parsedTeams.teamB}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-ash font-bold uppercase mt-1.5 tracking-wider">
            <span>{formattedDate}</span>
            <span>·</span>
            <span>Vol ${totalVolume.toLocaleString()}</span>
            <span>·</span>
            <span>Minimum 3 picks</span>
          </div>
        </div>
      )}

      {/* Empty state when no events */}
      {pvpEvents.length === 0 && (
        <div className="verity-card p-8 text-center text-sm text-ash font-medium">
          No active PvP Matchups available at this time.
        </div>
      )}

      {/* Category cards & form */}
      {pvpEvents.length > 0 && selectedPvpEvent && (
        <div className="flex flex-col gap-4">
          {/* Category Cards */}
          <div className="space-y-3 mt-2">
            {Object.entries(groupedOptions).map(([groupKey, opts]) => (
              <CategoryCard
                key={groupKey}
                groupKey={groupKey}
                opts={opts}
                pvpSelections={pvpSelections}
                parsedTeams={parsedTeams}
                isSubmitting={isSubmitting}
                onToggleSelection={onToggleSelection}
                onAddLiquidity={() => onAddLiquidity(opts[0].id)}
              />
            ))}
          </div>

          {/* Ticket Slip (Desktop) */}
          <div className="hidden sm:block">{renderTicketSlip()}</div>

          {/* Ticket Slip (Mobile) */}
          <div className="sm:hidden">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="fixed bottom-[calc(env(safe-area-inset-bottom)+82px)] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm clickable border-2 border-white/10"
            >
              <Receipt className="h-6 w-6" />
              {selectionCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                  {selectionCount}
                </span>
              )}
            </button>

            <Drawer
              open={isMobileDrawerOpen}
              onOpenChange={setIsMobileDrawerOpen}
            >
              <DrawerContent className="max-h-[92vh] flex flex-col rounded-t-3xl border-t border-stone-surface bg-warm-canvas pb-4 outline-none">
                <DrawerHeader className="relative flex-shrink-0 flex items-center justify-between border-b border-stone-surface pb-3 pt-2 mb-2 px-4">
                  <DrawerTitle className="font-heading text-lg font-bold text-charcoal-primary">
                    Your Selections
                  </DrawerTitle>
                  <DrawerClose className="rounded-full p-1.5 hover:bg-stone-surface text-ash hover:text-charcoal-primary transition-colors">
                    <X className="h-4.5 w-4.5" />
                  </DrawerClose>
                </DrawerHeader>
                <div className="px-5 flex flex-col min-h-0 flex-1 pb-safe overflow-hidden">
                  {renderTicketSlip()}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────
   CategoryCard — renders a single option group
   ────────────────────────────────────────────── */
function CategoryCard({
  groupKey,
  opts,
  pvpSelections,
  parsedTeams,
  isSubmitting,
  onToggleSelection,
  onAddLiquidity,
}: {
  groupKey: string
  opts: any[]
  pvpSelections: Record<string, string>
  parsedTeams: { teamA: string; teamB: string }
  isSubmitting: boolean
  onToggleSelection: (optId: string, selection: string) => void
  onAddLiquidity: () => void
}) {
  const firstOpt = opts[0]
  const isMulti = firstOpt?.outcomeCount && firstOpt.outcomeCount > 2
  const groupVolume = opts.reduce(
    (s: number, o: any) => s + Number(o.liquidity ?? 0),
    0,
  )
  const catMeta = getCategoryMeta(groupKey)

  // Extract handicap line from outcomes if O/U
  let handicapLine: string | null = null
  if (!isMulti && opts.length === 1) {
    const yc = firstOpt.yesCondition || ""
    const numMatch = yc.match(/(\d+(?:\.\d+)?)/)
    if (numMatch) handicapLine = numMatch[1]
  }

  // Check if any option in this group has a selection
  const hasSelection = opts.some((o: any) => pvpSelections[o.id])

  // Determine highlight color
  let selectedOptionColor: string | null = null
  if (hasSelection) {
    if (isMulti) {
      const selection = pvpSelections[firstOpt.id]
      if (selection) {
        const isDrawOption =
          selection.toLowerCase().includes("draw") ||
          selection.toLowerCase().includes("no goal") ||
          selection.toLowerCase().includes("equal")
        const isMatchWinner =
          groupKey === "match_winner" || groupKey === "major"
        selectedOptionColor =
          isDrawOption && !isMatchWinner ? "amber" : "emerald"
      }
    } else {
      selectedOptionColor = "emerald"
    }
  }

  return (
    <ArenaCategory
      title={catMeta.title}
      subtitle={
        handicapLine ? `Over / Under ${handicapLine}` : catMeta.subtitle
      }
      icon={catMeta.icon}
      accentColor={selectedOptionColor || catMeta.accent}
      volume={groupVolume}
      hasSelection={hasSelection}
      onAddLiquidity={onAddLiquidity}
    >
      {isMulti ? (
        <MultiWayOutcomes
          firstOpt={firstOpt}
          pvpSelections={pvpSelections}
          parsedTeams={parsedTeams}
          isSubmitting={isSubmitting}
          onToggleSelection={onToggleSelection}
        />
      ) : (
        <BinaryOutcomes
          opt={firstOpt}
          pvpSelections={pvpSelections}
          parsedTeams={parsedTeams}
          isSubmitting={isSubmitting}
          catMeta={catMeta}
          onToggleSelection={onToggleSelection}
        />
      )}
    </ArenaCategory>
  )
}

/* ──────────────────────────────────────────────
   MultiWayOutcomes — 3+ way market buttons
   ────────────────────────────────────────────── */
function MultiWayOutcomes({
  firstOpt,
  pvpSelections,
  parsedTeams,
  isSubmitting,
  onToggleSelection,
}: {
  firstOpt: any
  pvpSelections: Record<string, string>
  parsedTeams: { teamA: string; teamB: string }
  isSubmitting: boolean
  onToggleSelection: (optId: string, selection: string) => void
}) {
  return (
    <div
      className={`grid gap-2 ${firstOpt.outcomeCount === 3 ? "grid-cols-3" : firstOpt.outcomeCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}
    >
      {firstOpt.outcomes.map((outcomeName: string, idx: number) => {
        const price = firstOpt.outcomePrices?.[idx] ?? 1 / firstOpt.outcomeCount
        const priceCents = (price * 100).toFixed(1)
        const isSelected = pvpSelections[firstOpt.id] === outcomeName
        const displayName = cleanOutcomeName(
          outcomeName,
          parsedTeams.teamA,
          parsedTeams.teamB,
        )

        const isDrawOption =
          displayName.toLowerCase().includes("draw") ||
          displayName.toLowerCase().includes("no goal") ||
          displayName.toLowerCase().includes("equal")
        const btnColor = isSelected
          ? "bg-[#121212] dark:bg-white text-white dark:text-zinc-950 font-bold shadow-md relative"
          : "bg-[#FAF9F6] dark:bg-zinc-900/40 hover:bg-[#F3F1EC] dark:hover:bg-zinc-850/50 text-charcoal-primary dark:text-zinc-300 font-medium"

        return (
          <button
            key={outcomeName}
            type="button"
            disabled={isSubmitting}
            onClick={() => onToggleSelection(firstOpt.id, outcomeName)}
            className={`flex flex-col items-center justify-center gap-1 p-3.5 rounded-xl cursor-pointer transition-all ${btnColor} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="text-xs font-bold text-center leading-tight">
              {displayName}
            </span>
            <span
              className={`text-[9px] font-mono mt-1 opacity-70 ${isSelected ? "text-zinc-400 dark:text-zinc-600" : "text-ash"}`}
            >
              {priceCents}¢
            </span>

            {/* Red Check Circle Badge */}
            {isSelected && (
              <div className="absolute -top-1 -right-1 bg-[#FF3E00] text-white h-4.5 w-4.5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-zinc-900">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-2 w-2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ──────────────────────────────────────────────
   BinaryOutcomes — Over/Under market buttons
   ────────────────────────────────────────────── */
function BinaryOutcomes({
  opt,
  pvpSelections,
  parsedTeams,
  isSubmitting,
  catMeta,
  onToggleSelection,
}: {
  opt: any
  pvpSelections: Record<string, string>
  parsedTeams: { teamA: string; teamB: string }
  isSubmitting: boolean
  catMeta: { selectedBg: string; ring: string; unselectedBg: string }
  onToggleSelection: (optId: string, selection: string) => void
}) {
  // Compute probabilities in the component body — not in JSX
  const yesPool = Number(opt.usdcYesAmount ?? 0)
  const noPool = Number(opt.usdcNoAmount ?? 0)
  const totalPool = yesPool + noPool
  const yesProb = totalPool > 0 ? (yesPool / totalPool) * 100 : 50
  const noProb = 100 - yesProb

  let yesLabel = cleanOutcomeName(
    opt.yesCondition || "Yes",
    parsedTeams.teamA,
    parsedTeams.teamB,
  )
  let noLabel = cleanOutcomeName(
    opt.noCondition || "No",
    parsedTeams.teamA,
    parsedTeams.teamB,
  )

  if (opt.optionGroup === "red_card" || opt.optionGroup === "red_cards") {
    yesLabel = "Red card shown"
    noLabel = "No red card"
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onToggleSelection(opt.id, "YES")}
        disabled={isSubmitting}
        className={`flex flex-col items-center justify-center gap-1 p-3.5 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed relative ${
          pvpSelections[opt.id] === "YES"
            ? "bg-brand-primary dark:bg-white text-white dark:text-zinc-950 font-bold shadow-md"
            : "bg-[#FAF9F6] dark:bg-zinc-900/40 hover:bg-[#F3F1EC] dark:hover:bg-zinc-800/50 text-charcoal-primary dark:text-zinc-300 font-medium"
        }`}
      >
        <span className="text-xs font-bold">{yesLabel}</span>
        <span
          className={`text-[9px] font-mono mt-1 opacity-70 ${pvpSelections[opt.id] === "YES" ? "text-zinc-400 dark:text-zinc-600" : "text-ash"}`}
        >
          {yesProb.toFixed(1)}¢
        </span>

        {/* Red Check Circle Badge */}
        {pvpSelections[opt.id] === "YES" && (
          <div className="absolute -top-1 -right-1 bg-[#FF3E00] text-white h-4.5 w-4.5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-zinc-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-2 w-2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => onToggleSelection(opt.id, "NO")}
        disabled={isSubmitting}
        className={`flex flex-col items-center justify-center gap-1 p-3.5 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed relative ${
          pvpSelections[opt.id] === "NO"
            ? "bg-brand-primary dark:bg-white text-white dark:text-zinc-950 font-bold shadow-md"
            : "bg-[#FAF9F6] dark:bg-zinc-900/40 hover:bg-[#F3F1EC] dark:hover:bg-zinc-800/50 text-charcoal-primary dark:text-zinc-300 font-medium"
        }`}
      >
        <span className="text-xs font-bold">{noLabel}</span>
        <span
          className={`text-[9px] font-mono mt-1 opacity-70 ${pvpSelections[opt.id] === "NO" ? "text-zinc-400 dark:text-zinc-600" : "text-ash"}`}
        >
          {noProb.toFixed(1)}¢
        </span>

        {/* Red Check Circle Badge */}
        {pvpSelections[opt.id] === "NO" && (
          <div className="absolute -top-1 -right-1 bg-[#FF3E00] text-white h-4.5 w-4.5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-zinc-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-2 w-2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </button>
    </div>
  )
}
