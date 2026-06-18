import { Swords, Loader2 } from "lucide-react"

interface PvpDuelStatusProps {
  status: "queued" | "matched" | "resolved"
  pvpStatus: any
  runningScoreUser: number
  runningScoreOpponent: number
  profile?: any
}

const opponentColors = [
  "bg-[#ffbb26]", // sunburst-yellow
  "bg-meadow-green",
  "bg-ember-orange",
  "bg-coral-red",
]

function getAvatarColor(username: string): string {
  if (!username || username.toLowerCase() === "you") return "bg-sky-blue"
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % opponentColors.length
  return opponentColors[index]
}

// Custom brand avatar component with blob fallback
function DuelAvatar({
  avatarUrl,
  username,
}: {
  avatarUrl?: string
  username: string
}) {
  if (avatarUrl) {
    return (
      <div
        className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center ring-2 ring-white dark:ring-zinc-900 shadow-sm"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    )
  }

  const blobBg = getAvatarColor(username)
  return (
    <div
      className={`verity-blob h-10 w-10 shrink-0 ${blobBg} ring-2 ring-white dark:ring-zinc-900`}
    >
      <span className="verity-blob-smile" />
    </div>
  )
}

export default function PvpDuelStatus({
  status,
  pvpStatus,
  runningScoreUser,
  runningScoreOpponent,
  profile,
}: PvpDuelStatusProps) {
  if (status === "queued") {
    return (
      <div className="verity-card p-6 flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden bg-gradient-to-b from-stone-50/50 to-stone-100/30 dark:from-zinc-900/30 dark:to-zinc-900/10 border border-border dark:border-zinc-800">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-pulse" />

        <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
          <div className="relative h-14 w-14 rounded-full border border-indigo-150 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-center shrink-0 shadow-sm">
            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin absolute" />
            <Swords className="h-4.5 w-4.5 text-indigo-500 relative z-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold tracking-tight text-charcoal-primary dark:text-white">
              Scanning for Opponent...
            </h3>
            <p className="text-xs text-ash mt-0.5 font-medium leading-normal max-w-sm">
              Searching for a predictor with high selection divergence to pair.
            </p>
          </div>
        </div>

        <div className="bg-[#FAF9F6] dark:bg-zinc-900/40 px-4 py-3 rounded-xl border border-stone-200/20 dark:border-zinc-850/10 text-[10px] font-mono text-ash text-left space-y-1 shrink-0 w-full md:w-auto shadow-xs">
          <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping" />
            <span>Ticket Active</span>
          </p>
          <p className="truncate max-w-[200px]">
            • Matchup: {pvpStatus.event?.question}
          </p>
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
      ? "text-emerald-600 dark:text-emerald-400"
      : runningScoreUser < runningScoreOpponent
        ? "text-[#FF4D00]"
        : "text-ash"

  const userAvatarUrl = profile?.avatar_url || profile?.avatarUrl
  const opponentAvatarUrl =
    pvpStatus.opponent?.avatar_url || pvpStatus.opponent?.avatarUrl

  return (
    <div className="verity-card p-5 bg-white dark:bg-zinc-900/30 border border-border dark:border-zinc-800 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
        {/* Left: You */}
        <div className="w-full md:w-auto md:min-w-[180px] flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#FAF9F6] dark:bg-zinc-900/40 border border-stone-200/20 dark:border-zinc-850/10 shadow-xs shrink-0">
          <DuelAvatar avatarUrl={userAvatarUrl} username="You" />
          <div className="text-left min-w-0 flex-1">
            <h4 className="text-sm font-extrabold text-charcoal-primary dark:text-white leading-tight truncate">
              You
            </h4>
            <span className="text-[10px] font-mono text-ash font-medium mt-0.5 block">
              Score:{" "}
              <strong className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {runningScoreUser} pts
              </strong>
            </span>
          </div>
        </div>

        {/* Middle: VS / Result */}
        <div className="flex-1 flex flex-col items-center justify-center text-center py-2 px-4">
          {isResolved ? (
            <span
              className={`text-sm font-black uppercase tracking-wider ${resultColor} whitespace-nowrap`}
            >
              {resultLabel}
            </span>
          ) : (
            <div className="h-8 w-8 rounded-full border border-border dark:border-zinc-800 bg-[#FAF9F6] dark:bg-zinc-950 flex items-center justify-center shadow-xs">
              <Swords className="h-3.5 w-3.5 text-indigo-500" />
            </div>
          )}
          <span className="text-[9px] font-mono text-ash font-bold uppercase tracking-wider mt-1.5">
            Div: {pvpStatus.match?.divergenceScore ?? 0}
          </span>
        </div>

        {/* Right: Opponent */}
        <div className="w-full md:w-auto md:min-w-[180px] flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#FAF9F6] dark:bg-zinc-900/40 border border-stone-200/20 dark:border-zinc-850/10 shadow-xs shrink-0">
          <div className="text-left min-w-0 flex-1 pl-1 pr-2">
            <h4 className="text-sm font-extrabold text-charcoal-primary dark:text-white leading-tight truncate">
              @{pvpStatus.opponent?.username || "Opponent"}
            </h4>
            <span className="text-[10px] font-mono text-ash font-medium mt-0.5 block">
              Score:{" "}
              <strong className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {runningScoreOpponent} pts
              </strong>
            </span>
          </div>
          <DuelAvatar
            avatarUrl={opponentAvatarUrl}
            username={pvpStatus.opponent?.username || "Opponent"}
          />
        </div>
      </div>

      {isResolved && (
        <div className="pt-3 border-t border-dashed border-border dark:border-zinc-800 text-center">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
            Duel is resolved. Arena XP has been distributed.
          </p>
        </div>
      )}
    </div>
  )
}
