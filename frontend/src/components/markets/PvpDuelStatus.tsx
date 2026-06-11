import { Swords, User, Bot } from "lucide-react"

interface PvpDuelStatusProps {
  status: "queued" | "matched" | "resolved"
  pvpStatus: any
  runningScoreUser: number
  runningScoreOpponent: number
}

export default function PvpDuelStatus({
  status,
  pvpStatus,
  runningScoreUser,
  runningScoreOpponent,
}: PvpDuelStatusProps) {
  if (status === "queued") {
    return (
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
    )
  }

  // Resolved or Matched — both share the H2H layout
  const isResolved = status === "resolved"
  const resultLabel =
    runningScoreUser > runningScoreOpponent
      ? "YOU WON 🏆"
      : runningScoreUser < runningScoreOpponent
        ? "YOU LOST ❌"
        : "DRAW 🤝"
  const resultColor =
    runningScoreUser > runningScoreOpponent
      ? "text-meadow-green"
      : runningScoreUser < runningScoreOpponent
        ? "text-ember-orange"
        : "text-ash"

  return (
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

        {/* Middle: VS / Result */}
        <div className="flex flex-col items-center shrink-0">
          {isResolved ? (
            <span
              className={`text-base font-extrabold uppercase tracking-widest ${resultColor}`}
            >
              {resultLabel}
            </span>
          ) : (
            <div className="h-8 w-8 rounded-full border border-border dark:border-zinc-800 bg-white-surface dark:bg-zinc-950 flex items-center justify-center shadow-sm">
              <Swords className="h-4 w-4 text-sky-blue" />
            </div>
          )}
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

      {isResolved && (
        <div className="mt-4 pt-4 border-t border-border dark:border-zinc-800">
          <p className="text-xs text-ash">
            Duel is resolved. Arena XP has been awarded.
          </p>
        </div>
      )}
    </div>
  )
}
