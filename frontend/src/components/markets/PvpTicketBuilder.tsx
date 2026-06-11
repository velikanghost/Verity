import { useMemo } from "react"
import { HelpCircle, ChevronRight } from "lucide-react"
import ArenaCategory, { getCategoryMeta } from "./PvpArenaCategory"
import PvpClaimBanner from "./PvpClaimBanner"

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

interface PvpTicketBuilderProps {
  selectedPvpEvent: any
  pvpEvents: any[]
  pvpStatus: any
  pvpSelections: Record<string, string>
  betAmountPerSelection: number
  isSubmitting: boolean
  showTooltip: boolean
  claimedMarketIds: Set<string>
  referralsData: any
  parsedTeams: { teamA: string; teamB: string }
  groupedOptions: Record<string, any[]>
  onToggleSelection: (optId: string, selection: string) => void
  onSetBetAmount: (amount: number) => void
  onSetShowTooltip: (show: boolean) => void
  onSubmitTicket: () => Promise<void>
  onClaim: (marketIds: string[], totalWinnings: number) => Promise<void>
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
  claimedMarketIds,
  referralsData,
  parsedTeams,
  groupedOptions,
  onToggleSelection,
  onSetBetAmount,
  onSetShowTooltip,
  onSubmitTicket,
  onClaim,
  onAddLiquidity,
}: PvpTicketBuilderProps) {
  const selectionCount = Object.keys(pvpSelections).length

  return (
    <div className="verity-card p-5 flex flex-col gap-4">
      {/* Header */}
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
            onMouseEnter={() => onSetShowTooltip(true)}
            onMouseLeave={() => onSetShowTooltip(false)}
            className="p-1.5 rounded-full text-ash hover:text-charcoal-primary dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            aria-label="Rules Info"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-9 z-50 w-72 p-4 rounded-xl bg-white dark:bg-zinc-950 border border-border dark:border-zinc-800 shadow-xl text-xs leading-relaxed text-charcoal-secondary dark:text-zinc-300 font-sans font-medium">
              Each correct pick scores 1 point. Win: 100 Result XP, draw: 50,
              loss: 30. A perfect score adds 20 XP, and an active boost applies
              1.2x to the total.{" "}
              <strong className="text-amber-600 dark:text-amber-400">
                Note: You can select at most one prediction per category group
                to build your ticket.
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Empty state / claim fallback when no events */}
      {pvpEvents.length === 0 && (
        <PvpClaimBanner
          picks={pvpStatus?.ticket?.picks}
          claimedMarketIds={claimedMarketIds}
          onClaim={onClaim}
          showEmptyState
        />
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
                })}
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
                    onSetBetAmount(Math.max(1, Number(e.target.value)))
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
                Total Ticket Cost ({selectionCount} Selections)
              </span>
              <strong className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {betAmountPerSelection * selectionCount} USDC
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

          {/* Claim Winnings Banner at bottom */}
          <PvpClaimBanner
            picks={pvpStatus?.ticket?.picks}
            claimedMarketIds={claimedMarketIds}
            onClaim={onClaim}
            className="mt-4"
          />
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
        selectedOptionColor = isDrawOption ? "amber" : "emerald"
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
        const price =
          firstOpt.outcomePrices?.[idx] ?? 1 / firstOpt.outcomeCount
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
          ? isDrawOption
            ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-400/30"
            : "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/30"
          : "bg-stone-50/50 dark:bg-zinc-900/20 text-stone-600 dark:text-zinc-400 border border-stone-200/80 dark:border-zinc-800/60 hover:bg-stone-100/60 dark:hover:bg-zinc-800/40"

        return (
          <button
            key={outcomeName}
            type="button"
            disabled={isSubmitting}
            onClick={() => onToggleSelection(firstOpt.id, outcomeName)}
            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl cursor-pointer transition-all ${btnColor} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="text-sm font-bold text-center leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] font-mono mt-0.5 opacity-70">
              {priceCents}¢
            </span>
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
        onClick={() => onToggleSelection(opt.id, "YES")}
        disabled={isSubmitting}
        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          pvpSelections[opt.id] === "YES"
            ? `${catMeta.selectedBg} text-white shadow-md ring-2 ${catMeta.ring}`
            : `${catMeta.unselectedBg} hover:opacity-80`
        }`}
      >
        <span className="text-sm font-bold">{yesLabel}</span>
        <span className="text-[10px] font-mono opacity-70">
          {yesProb.toFixed(1)}¢
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleSelection(opt.id, "NO")}
        disabled={isSubmitting}
        className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          pvpSelections[opt.id] === "NO"
            ? `${catMeta.selectedBg} text-white shadow-md ring-2 ${catMeta.ring}`
            : `${catMeta.unselectedBg} hover:opacity-80`
        }`}
      >
        <span className="text-sm font-bold">{noLabel}</span>
        <span className="text-[10px] font-mono opacity-70">
          {noProb.toFixed(1)}¢
        </span>
      </button>
    </div>
  )
}
