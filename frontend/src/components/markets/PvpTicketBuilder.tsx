"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { HelpCircle, ChevronRight, Check } from "lucide-react"
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
  onSubmitTicket: () => Promise<void>
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
  onAddLiquidity,
}: PvpTicketBuilderProps) {
  const selectionCount = Object.keys(pvpSelections).length
  const { rawBalance, formattedBalance } = useUsdcBalance()

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

          {/* Selection Summary */}
          {selectionCount > 0 && (
            <div className="rounded-xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-3 mt-2">
              <span className="block text-[10px] font-bold uppercase text-ash tracking-wider mb-1.5">
                Your Picks — {selectionCount} selections
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(pvpSelections).map(([optId, selection]) => {
                  const opt = selectedPvpEvent.options.find(
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
                    <span
                      key={optId}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {opt?.optionName}: {displaySelection}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bet amount settings */}
          <div className="flex flex-col gap-3.5 bg-stone-100/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-border/60 dark:border-zinc-800/40 mt-4 mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-bold text-ash uppercase block">
                  Bet Amount per selection
                </span>
                <span className="text-[10px] text-ash block">
                  Each selected option will be purchased for this amount.
                </span>
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <span className="text-[10px] font-mono text-ash/80 sm:hidden block text-right">
                  Balance: {formattedBalance} USDC
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={
                      betAmountPerSelection === 0 ? "" : betAmountPerSelection
                    }
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        onSetBetAmount(0)
                      } else {
                        onSetBetAmount(Number(val))
                      }
                    }}
                    className="w-full sm:w-20 h-9 px-3 border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-900 text-xs font-bold font-mono rounded-md text-charcoal-primary dark:text-white focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-mono font-bold text-charcoal-primary dark:text-zinc-400">
                    USDC
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-border/60 dark:border-zinc-800/60 pt-2.5 mt-0.5">
              <span className="text-xs font-mono text-ash font-bold uppercase">
                Total Ticket Cost ({selectionCount} Selections)
              </span>
              <strong className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {betAmountPerSelection * selectionCount} USDC
              </strong>
            </div>
          </div>

          {/* XP boost indicator and submit button */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-t border-border dark:border-zinc-800 pt-4 mt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {referralsData?.welcomeBoosts?.isEligible &&
              referralsData.welcomeBoosts.nextGameMultiplier > 1.2 ? (
                <span className="inline-flex items-center justify-center text-center gap-1 px-2.5 py-1.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 text-[10px] font-bold font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm w-full sm:w-auto">
                  ⚡ Welcome Boost: {referralsData.welcomeBoosts.nextGameMultiplier}x XP ({referralsData.welcomeBoosts.ticketsCount === 0 ? "1st" : "2nd"} game)
                </span>
              ) : referralsData?.downtimeBoostRemaining &&
                referralsData.downtimeBoostRemaining > 0 ? (
                <span className="inline-flex items-center justify-center text-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/5 text-[10px] font-bold font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm w-full sm:w-auto">
                  ⚡ Boost: 2x ({referralsData.downtimeBoostRemaining} remaining)
                </span>
              ) : (
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-ash/80 text-center w-full sm:w-auto block">
                  ⚡ Boosts Remaining:{" "}
                  <strong className="text-charcoal-primary dark:text-white font-mono font-bold">
                    {referralsData?.doubleBoostRemaining ?? 0}
                  </strong>
                  {referralsData &&
                    referralsData.doubleBoostRemaining > 0 &&
                    " (Auto 1.2x XP)"}
                </span>
              )}
            </div>

            <button
              onClick={onSubmitTicket}
              disabled={isSubmitting || selectionCount < 3}
              className="verity-pill px-6 h-11 bg-indigo-600 text-white hover:bg-indigo-500 font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting
                ? "Submitting..."
                : selectionCount < 3
                  ? `Select ${3 - selectionCount} More Categories`
                  : "Submit ticket & Queue"}
              <ChevronRight className="h-4 w-4" />
            </button>
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
