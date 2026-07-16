"use client"

import { useState } from "react"
import { History, X, Swords, Award } from "lucide-react"
import { parseEventTeams } from "./PvpMatchupCarousel"
import { usePvpMatchHistoryQuery } from "@/store/verity/verityQueries"

export default function DuelHistory() {
  const { data: matchHistory = [] } = usePvpMatchHistoryQuery()
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null)

  return (
    <div className="verity-card overflow-hidden flex flex-col bg-white dark:bg-zinc-900/30">
      <div className="p-4 border-b border-border dark:border-zinc-800 flex items-center gap-2">
        <h3 className="font-sans text-xs font-black uppercase tracking-wider text-charcoal-primary dark:text-white">
          DUEL HISTORY
        </h3>
      </div>

      {matchHistory.length === 0 ? (
        <div className="p-6 text-center text-xs text-ash font-mono">
          No pvp matches resolved yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-4 max-h-[360px] overflow-y-auto">
          {matchHistory.map((item: any) => {
            const { teamA, teamB } = parseEventTeams(item.eventQuestion)
            return (
              <div
                key={item.matchId}
                onClick={() => setSelectedMatch(item)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF9F6] dark:bg-zinc-900/40 border border-stone-200/20 dark:border-zinc-850/10 hover:bg-[#F3F1EC] dark:hover:bg-zinc-800/45 transition-all cursor-pointer text-left shadow-xs hover:shadow-sm"
              >
                {/* Left Column: Match Details */}
                <div className="space-y-1 min-w-0 flex-1 pr-3">
                  <h4 className="text-xs font-bold tracking-tight text-charcoal-primary dark:text-white truncate">
                    {teamA} vs {teamB}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-ash">
                    <span className="truncate max-w-[90px]">
                      @{item.opponent?.username || "opponent"}
                    </span>
                    <span>·</span>
                    <span className="font-mono">
                      Score {item.myScore} – {item.oppScore}
                    </span>
                  </div>
                </div>

                {/* Right Column: Status & XP Pills */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-mono uppercase tracking-wider ${
                      item.outcome === "WIN"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                        : item.outcome === "LOSS"
                          ? "bg-[#FFEBE5] text-[#FF4D00] dark:bg-[#FF4D00]/10 dark:text-[#FF6633]"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {item.outcome}
                  </span>
                  <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    +{item.xpEarned} XP
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Duel Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-border dark:border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Modal Header */}
            <div className="p-4 border-b border-border dark:border-zinc-800 flex items-center justify-between bg-stone-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-indigo-500" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-charcoal-primary dark:text-white">
                  Duel Match Details
                </span>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-ash hover:text-charcoal-primary dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Event Question */}
              <div>
                <span className="font-mono text-[9px] font-bold text-ash uppercase tracking-wider block">
                  Match Event
                </span>
                <h4 className="text-base font-bold text-charcoal-primary dark:text-white leading-snug mt-1">
                  {selectedMatch.eventQuestion}
                </h4>
                <span className="text-[10px] font-mono text-ash mt-1 block">
                  Resolved At:{" "}
                  {new Date(selectedMatch.resolvedAt).toLocaleString()}
                </span>
              </div>

              {/* Outcome Banner & Stats Summary */}
              <div className="p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 bg-linear-to-br from-indigo-50/10 via-transparent to-transparent border-border dark:border-zinc-800">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div
                    className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 border ${
                      selectedMatch.outcome === "WIN"
                        ? "bg-meadow-green/10 border-meadow-green/20 text-meadow-green"
                        : selectedMatch.outcome === "LOSS"
                          ? "bg-ember-orange/10 border-ember-orange/20 text-ember-orange"
                          : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
                    }`}
                  >
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono font-bold text-ash uppercase tracking-wider block">
                      Outcome
                    </span>
                    <span
                      className={`text-base font-extrabold tracking-tight ${
                        selectedMatch.outcome === "WIN"
                          ? "text-meadow-green"
                          : selectedMatch.outcome === "LOSS"
                            ? "text-ember-orange"
                            : "text-ash"
                      }`}
                    >
                      {selectedMatch.outcome === "WIN"
                        ? "YOU WON"
                        : selectedMatch.outcome === "LOSS"
                          ? "YOU LOST"
                          : "DRAW"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 w-full md:w-auto flex-1 md:justify-end">
                  <div className="bg-stone-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-border dark:border-zinc-900 text-center">
                    <span className="text-[9px] font-mono text-ash block">
                      Score
                    </span>
                    <strong className="text-sm font-bold font-sans text-charcoal-primary dark:text-white mt-0.5 block">
                      {selectedMatch.myScore} - {selectedMatch.oppScore}
                    </strong>
                  </div>
                  <div className="bg-stone-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-border dark:border-zinc-900 text-center">
                    <span className="text-[9px] font-mono text-ash block">
                      XP Earned
                    </span>
                    <strong className="text-sm font-bold font-sans text-charcoal-primary dark:text-white mt-0.5 block">
                      +{selectedMatch.xpEarned} XP
                    </strong>
                  </div>
                  <div className="bg-stone-50 dark:bg-zinc-900/60 p-2.5 rounded-lg border border-border dark:border-zinc-900 text-center">
                    <span className="text-[9px] font-mono text-ash block">
                      Profit/Loss
                    </span>
                    {(() => {
                      const totalBet =
                        selectedMatch.myPicks?.reduce(
                          (acc: number, p: any) => acc + (p.investedUsdc ?? 5),
                          0,
                        ) ?? 0
                      const totalWon =
                        selectedMatch.myPicks?.reduce(
                          (acc: number, p: any) => acc + (p.winningsUsdc ?? 0),
                          0,
                        ) ?? 0
                      const net = totalWon - totalBet
                      return (
                        <strong
                          className={`text-sm font-bold font-mono mt-0.5 block ${net >= 0 ? "text-meadow-green" : "text-ember-orange"}`}
                        >
                          {net >= 0 ? "+" : ""}
                          {net.toFixed(2)} USDC
                        </strong>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Picks list comparison */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border dark:border-zinc-800 pb-2">
                  <span className="text-xs font-mono font-bold text-ash uppercase tracking-wider">
                    Predictions Comparison
                  </span>
                  <span className="text-[10px] text-ash font-mono font-medium">
                    Opponent: @{selectedMatch.opponent?.username || "Opponent"}
                  </span>
                </div>

                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {selectedMatch.myPicks?.map((pick: any) => {
                    const oppPick = selectedMatch.oppPicks?.find(
                      (p: any) => p.marketId === pick.marketId,
                    )
                    const bet = pick.investedUsdc ?? 5
                    const won = pick.winningsUsdc ?? 0
                    const resolvedLabel =
                      pick.resolvedOutcome === "YES"
                        ? pick.yesCondition || "YES"
                        : pick.resolvedOutcome === "NO"
                          ? pick.noCondition || "NO"
                          : pick.resolvedOutcome || "Pending"

                    return (
                      <div
                        key={pick.marketId}
                        className="p-3.5 rounded-xl bg-stone-50 dark:bg-zinc-900/40 border border-border dark:border-zinc-900 flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs font-bold text-charcoal-primary dark:text-zinc-200 uppercase tracking-tight">
                            {pick.optionName}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                              (pick.arenaCorrect ?? pick.isCorrect) === true
                                ? "bg-meadow-green/10 text-meadow-green border border-meadow-green/20"
                                : (pick.arenaCorrect ?? pick.isCorrect) === false
                                  ? "bg-ember-orange/10 text-ember-orange border border-ember-orange/20"
                                  : "bg-stone-100 dark:bg-zinc-800 text-ash"
                            }`}
                          >
                            {(pick.arenaCorrect ?? pick.isCorrect) === true
                              ? "CORRECT"
                              : (pick.arenaCorrect ?? pick.isCorrect) === false
                                ? "WRONG"
                                : "PENDING"}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <div className="bg-white-surface dark:bg-zinc-950 p-2 rounded-[8px] border border-border/80 dark:border-zinc-900/80">
                            <span className="text-[8px] font-mono text-ash uppercase block">
                              You Picked
                            </span>
                            <span
                              className={`text-xs font-bold mt-0.5 block ${
                                pick.selection === "YES"
                                  ? "text-meadow-green"
                                  : pick.selection === "NO"
                                    ? "text-ember-orange"
                                    : "text-indigo-600 dark:text-indigo-400"
                              }`}
                            >
                              {pick.selection === "YES"
                                ? pick.yesCondition || "YES"
                                : pick.selection === "NO"
                                  ? pick.noCondition || "NO"
                                  : pick.selection}
                            </span>
                          </div>

                          <div className="bg-white-surface dark:bg-zinc-950 p-2 rounded-[8px] border border-border/80 dark:border-zinc-900/80">
                            <span className="text-[8px] font-mono text-ash uppercase block">
                              Opponent Picked
                            </span>
                            <span
                              className={`text-xs font-bold mt-0.5 block ${
                                oppPick?.selection === "YES"
                                  ? "text-meadow-green"
                                  : oppPick?.selection === "NO"
                                    ? "text-ember-orange"
                                    : "text-indigo-600 dark:text-indigo-400"
                              }`}
                            >
                              {oppPick
                                ? oppPick.selection === "YES"
                                  ? pick.yesCondition || "YES"
                                  : oppPick.selection === "NO"
                                    ? pick.noCondition || "NO"
                                    : oppPick.selection
                                : "N/A"}
                            </span>
                          </div>

                          <div className="bg-white-surface dark:bg-zinc-950 p-2 rounded-[8px] border border-border/80 dark:border-zinc-900/80">
                            <span className="text-[8px] font-mono text-ash uppercase block">
                              Outcome
                            </span>
                            <span className="text-xs font-bold text-charcoal-primary dark:text-white mt-0.5 block truncate">
                              {resolvedLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-mono text-ash border-t border-dashed border-border/60 dark:border-zinc-800/60 pt-2 mt-1">
                          <span>Staked: {bet.toFixed(2)} USDC</span>
                          <span
                            className={
                              won > 0 ? "text-meadow-green font-bold" : ""
                            }
                          >
                            Winnings: {won.toFixed(2)} USDC
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border dark:border-zinc-800 flex justify-end bg-stone-50 dark:bg-zinc-900/50">
              <button
                onClick={() => setSelectedMatch(null)}
                className="px-4 py-2 rounded-[10px] bg-charcoal-primary hover:bg-charcoal-primary/95 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
