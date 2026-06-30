import { Trophy, Target, Flag, Swords, RectangleVertical } from "lucide-react"

/* ──────────────────────────────────────────────
   Category metadata helper
   ────────────────────────────────────────────── */
export interface CatMeta {
  title: string
  subtitle: string
  icon: React.ReactNode
  accent: string
  selectedBg: string
  ring: string
  unselectedBg: string
}

export function getCategoryMeta(groupKey: string): CatMeta {
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
    extra_time_penalties: {
      title: "Extra Time / Penalties Winner",
      subtitle: "3-way: Shootout / Decided in ET / Shootout",
      icon: <Swords className="h-4 w-4" />,
      accent: "emerald",
      selectedBg: "bg-emerald-600",
      ring: "ring-emerald-400/30",
      unselectedBg:
        "bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40",
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
interface ArenaCategoryProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  accentColor: string
  volume: number
  hasSelection: boolean
  onAddLiquidity: () => void
  children: React.ReactNode
}

export default function ArenaCategory({
  title,
  subtitle,
  icon,
  accentColor,
  volume,
  hasSelection,
  onAddLiquidity,
  children,
}: ArenaCategoryProps) {
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
