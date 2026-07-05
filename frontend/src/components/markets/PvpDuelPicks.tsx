import { cleanOutcomeName } from "./PvpTicketBuilder"

interface PvpDuelPicksProps {
  pvpStatus: any
  onSelectChildMarketForTrade?: (market: any) => void
  onAddLiquidity?: (marketId: string) => void
}

export default function PvpDuelPicks({ pvpStatus, onSelectChildMarketForTrade, onAddLiquidity }: PvpDuelPicksProps) {
  const userPicks = pvpStatus.ticket?.picks || []
  const oppPicks = pvpStatus.opponent?.picks || []

  const allMarketIds = Array.from(
    new Set([
      ...userPicks.map((p: any) => p.marketId),
      ...oppPicks.map((p: any) => p.marketId),
    ]),
  ).filter(Boolean)

  const question = pvpStatus.event?.question || ""
  const parsedTeams = (() => {
    if (!question) return { teamA: "Team A", teamB: "Team B" }
    const vsMatch = question.match(/(.+?)\s+vs\.?\s+(.+)/i)
    if (vsMatch) return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() }
    const dashMatch = question.match(/(.+?)\s+-\s+(.+)/)
    if (dashMatch)
      return { teamA: dashMatch[1].trim(), teamB: dashMatch[2].trim() }
    return { teamA: "Team A", teamB: "Team B" }
  })()

  const formatPickSelection = (selection: string | null, opt: any) => {
    if (!selection) return ""
    const group = opt?.optionGroup || ""
    if (group === "red_card" || group === "red_cards") {
      if (selection === "YES") return "Red card shown"
      if (selection === "NO") return "No red card"
    }
    const rawVal =
      selection === "YES"
        ? opt?.yesCondition || "YES"
        : selection === "NO"
          ? opt?.noCondition || "NO"
          : selection

    return cleanOutcomeName(rawVal, parsedTeams.teamA, parsedTeams.teamB)
  }

  return (
    <div className="verity-card p-5">
      <div className="border-b border-border dark:border-zinc-800 pb-3 mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-charcoal-primary dark:text-white">
            Your Predictions & Outcomes
          </h3>
          <p className="text-xs text-ash mt-0.5">
            Track your selections, payouts, and opponent picks in real-time.
          </p>
        </div>
      </div>

      {/* Per-pick rows */}
      <div className="space-y-3">
        {allMarketIds.map((marketId: any) => {
          const pick = userPicks.find((p: any) => p.marketId === marketId)
          const childOpt = pvpStatus.event?.options.find(
            (o: any) => o.id === marketId,
          )
          const oppPick = pvpStatus.opponent?.picks.find(
            (p: any) => p.marketId === marketId,
          )
          const invested = pick?.investedUsdc ?? 0

          const isResolved =
            childOpt?.status === "resolved" ||
            (childOpt?.resolvedOutcome !== null && childOpt?.resolvedOutcome !== undefined) ||
            pick?.status === "resolved" ||
            (pick?.resolvedOutcome !== null && pick?.resolvedOutcome !== undefined) ||
            oppPick?.status === "resolved" ||
            (oppPick?.resolvedOutcome !== null && oppPick?.resolvedOutcome !== undefined)

          const resolvedOutcome =
            childOpt?.resolvedOutcome ||
            pick?.resolvedOutcome ||
            oppPick?.resolvedOutcome ||
            null

          return (
            <div
              key={marketId}
              className="flex flex-col gap-3 p-4 rounded-xl bg-parchment-card dark:bg-zinc-900/40 border border-border dark:border-zinc-800/85 transition-all"
            >
              {/* Top row: Title + Shares */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold tracking-wide text-charcoal-primary dark:text-zinc-200 uppercase truncate">
                  {(
                    childOpt?.optionName ||
                    pick?.optionName ||
                    oppPick?.optionName ||
                    "Pick"
                  ).toUpperCase()}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-inter">
                    Shares: <strong>{invested.toFixed(2)}</strong>
                  </span>
                  {childOpt && !isResolved && onAddLiquidity && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddLiquidity(marketId)
                      }}
                      className="px-2 py-0.5 rounded border border-border dark:border-zinc-700 text-[9px] font-bold text-ash dark:text-zinc-400 bg-white-surface dark:bg-zinc-900 hover:text-charcoal-primary dark:hover:text-zinc-200 hover:border-charcoal-primary/30 dark:hover:border-zinc-500 transition-all uppercase tracking-wider"
                    >
                      + LP
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom row: Selections */}
              <div className="grid grid-cols-2 md:flex md:items-stretch gap-2">
                {/* Your Pick */}
                <div className="flex flex-col items-start bg-white-surface dark:bg-zinc-950 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 flex-1 min-w-0">
                  <span className="text-[9px] font-inter text-ash uppercase">
                    You
                  </span>
                  <span className="text-xs font-semibold text-charcoal-primary dark:text-zinc-200 truncate max-w-full">
                    {pick
                      ? formatPickSelection(pick.selection, childOpt) || "—"
                      : "—"}
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
                      {oppPick
                        ? formatPickSelection(oppPick.selection, childOpt) ||
                          "—"
                        : "—"}
                    </span>
                  )}
                </div>

                {/* Outcome — only shown when resolved */}
                {isResolved && (
                  <div className="flex flex-col items-start bg-zinc-100 dark:bg-zinc-900/60 px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 flex-1 min-w-0">
                    <span className="text-[9px] font-inter text-ash uppercase">
                      Outcome
                    </span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-full">
                      {formatPickSelection(resolvedOutcome, childOpt) || ""}
                    </span>
                  </div>
                )}

                {/* Points — only shown when resolved */}
                {((pick && pick.isCorrect !== null) ||
                  (oppPick && oppPick.isCorrect !== null)) && (
                  <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded-[8px] border border-border dark:border-zinc-800 shrink-0">
                    <span className="text-[9px] font-inter text-ash uppercase">
                      Points
                    </span>
                    <span
                      className={`text-xs font-bold ${pick?.isCorrect ? "text-meadow-green" : "text-charcoal-primary dark:text-zinc-400"}`}
                    >
                      {pick?.isCorrect ? "+1 pt" : "0 pts"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
