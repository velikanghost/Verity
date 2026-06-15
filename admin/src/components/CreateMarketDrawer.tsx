"use client"

import { useState, useMemo, useCallback } from "react"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Swords,
  Flag,
  Trophy,
  Target,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-react"

interface AdminBalances {
  adminAddress: string
  arcBalance: number
  usdcBalance: number
  preDepositUsdcPerOption: number
  creationFeeUsdc: number
}

interface CategoryState {
  enabled: boolean
  line?: number
}

interface CreateMarketDrawerProps {
  isOpen: boolean
  onClose: () => void
  adminBalances: AdminBalances | null
  fetchMarkets: () => void
  fetchAdminStatus: () => void
  fetchMetricsData: () => void
}

const CORNER_LINES = [6.5, 7.5, 8.5, 9.5, 10.5]
const GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5]
const CARD_LINES = [2.5, 3.5, 4.5, 5.5, 6.5]
const OFFSIDE_LINES = [0.5, 1.5, 2.5, 3.5, 4.5]

function parseTeams(question: string): { teamA: string; teamB: string } {
  const vsMatch = question.match(/(.+?)\s+vs\.?\s+(.+)/i)
  if (vsMatch) return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() }
  const dashMatch = question.match(/(.+?)\s+-\s+(.+)/)
  if (dashMatch)
    return { teamA: dashMatch[1].trim(), teamB: dashMatch[2].trim() }
  return { teamA: "Team A", teamB: "Team B" }
}

export default function CreateMarketDrawer({
  isOpen,
  onClose,
  adminBalances,
  fetchMarkets,
  fetchAdminStatus,
  fetchMetricsData,
}: CreateMarketDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [pvpQuestion, setPvpQuestion] = useState("")
  const [pvpDeadline, setPvpDeadline] = useState("")
  const [pvpLockTime, setPvpLockTime] = useState("")
  const [pvpResolutionSource, setPvpResolutionSource] =
    useState("World Cup Oracle")

  // Category-based proposition builder state
  const [categories, setCategories] = useState<Record<string, CategoryState>>({
    winner: { enabled: false },
    corners: { enabled: false, line: 9.5 },
    goals: { enabled: false, line: 2.5 },
    cards: { enabled: false, line: 3.5 },
    firstScore: { enabled: false },
    redCard: { enabled: false },
    btts: { enabled: false },
    offsides: { enabled: false, line: 3.5 },
  })

  // Custom propositions
  const [customOptions, setCustomOptions] = useState<string[]>([])
  const [customOptionText, setCustomOptionText] = useState("")

  // Parse team names from question
  const { teamA, teamB } = useMemo(() => parseTeams(pvpQuestion), [pvpQuestion])
  const hasTeams = pvpQuestion.trim().length > 0

  // Build propositions from enabled categories
  const generatedOptions = useMemo(() => {
    const opts: string[] = []
    const a = hasTeams ? teamA : "Team A"
    const b = hasTeams ? teamB : "Team B"

    if (categories.winner.enabled) {
      opts.push(`${a} wins the match`)
      opts.push(`Match ends in a draw`)
      opts.push(`${b} wins the match`)
    }

    if (categories.firstScore.enabled) {
      opts.push(`${a} scores first`)
      opts.push(`No goal in the match`)
      opts.push(`${b} scores first`)
    }

    if (categories.redCard.enabled) {
      opts.push(`At least one red card shown`)
      opts.push(`No red cards shown`)
    }

    if (categories.corners.enabled && categories.corners.line != null) {
      const line = categories.corners.line
      opts.push(`Match has under ${line} corners`)
      opts.push(`Match has over ${line} corners`)
    }

    if (categories.goals.enabled && categories.goals.line != null) {
      const line = categories.goals.line
      opts.push(`Match has under ${line} goals`)
      opts.push(`Match has over ${line} goals`)
    }

    if (categories.cards.enabled && categories.cards.line != null) {
      const line = categories.cards.line
      opts.push(`Match has under ${line} yellow cards`)
      opts.push(`Match has over ${line} yellow cards`)
    }

    if (categories.btts?.enabled) {
      opts.push(`Both teams to score - Yes`)
      opts.push(`Both teams to score - No`)
    }

    if (categories.offsides?.enabled && categories.offsides.line != null) {
      const line = categories.offsides.line
      opts.push(`Match has under ${line} offsides`)
      opts.push(`Match has over ${line} offsides`)
    }

    return [...opts, ...customOptions]
  }, [categories, customOptions, teamA, teamB, hasTeams])

  const toggleCategory = useCallback((key: string) => {
    setCategories((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }, [])

  const setCategoryLine = useCallback((key: string, line: number) => {
    setCategories((prev) => ({
      ...prev,
      [key]: { ...prev[key], line },
    }))
  }, [])

  function handleAddCustomOption() {
    const text = customOptionText.trim()
    if (!text) return
    if (
      [...generatedOptions]
        .map((o) => o.toLowerCase())
        .includes(text.toLowerCase())
    ) {
      toast.error("Option already exists.")
      return
    }
    setCustomOptions([...customOptions, text])
    setCustomOptionText("")
  }

  function handleRemoveCustomOption(index: number) {
    setCustomOptions(customOptions.filter((_, i) => i !== index))
  }

  async function handleDeployPvpEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!pvpQuestion.trim() || !pvpDeadline || !pvpResolutionSource.trim()) {
      toast.error("Please fill all fields.")
      return
    }

    if (
      generatedOptions.length < 3 ||
      generatedOptions.some((opt) => !opt.trim())
    ) {
      toast.error(
        "You must enable enough categories for at least 3 propositions.",
      )
      return
    }

    setLoading(true)
    try {
      await apiRequest("/pvp/events", {
        method: "POST",
        body: JSON.stringify({
          question: pvpQuestion.trim(),
          deadline: new Date(pvpDeadline).toISOString(),
          lockTime: pvpLockTime
            ? new Date(pvpLockTime).toISOString()
            : undefined,
          resolutionSource: pvpResolutionSource.trim(),
          options: generatedOptions.map((opt) => opt.trim()),
        }),
      })
      toast.success(
        `Successfully deployed PvP Event + ${generatedOptions.length} Proposition markets!`,
      )
      setPvpQuestion("")
      setPvpDeadline("")
      setPvpLockTime("")
      setCategories({
        winner: { enabled: false },
        corners: { enabled: false, line: 9.5 },
        goals: { enabled: false, line: 2.5 },
        cards: { enabled: false, line: 3.5 },
        firstScore: { enabled: false },
        redCard: { enabled: false },
        btts: { enabled: false },
        offsides: { enabled: false, line: 3.5 },
      })
      setCustomOptions([])
      onClose()
      void fetchMarkets()
      void fetchAdminStatus()
      void fetchMetricsData()
    } catch (err: any) {
      toast.error(err.message || "Failed to deploy event.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      direction="right"
    >
      <DrawerContent className="p-6 h-full flex flex-col bg-white border-l border-stone-200 data-[vaul-drawer-direction=right]:sm:max-w-2xl">
        <DrawerHeader className="px-0">
          <DrawerTitle className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Swords className="h-5 w-5 text-indigo-600" />
            Deploy PvP World Cup Matchup
          </DrawerTitle>
          <DrawerDescription className="text-xs text-stone-500">
            Create a parent matchup event and launch multiple corresponding
            child prediction markets automatically funded with escrow
            pre-deposits.
          </DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={handleDeployPvpEvent}
          className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 mt-4"
        >
          {/* Match Title */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Match Title / Question
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Paraguay vs Japan"
              value={pvpQuestion}
              onChange={(e) => setPvpQuestion(e.target.value)}
              className="w-full h-11 px-3 border border-stone-200 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
            />
            {hasTeams && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-700">
                  <Flag className="h-3 w-3" />
                  {teamA}
                </span>
                <span className="text-[10px] font-bold text-stone-400">vs</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 border border-rose-100 text-[11px] font-semibold text-rose-700">
                  <Flag className="h-3 w-3" />
                  {teamB}
                </span>
              </div>
            )}
          </div>

          {/* Deadline & Lock Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Lock Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={pvpLockTime}
                onChange={(e) => setPvpLockTime(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker()
                  } catch (err) {}
                }}
                className="w-full h-11 px-3 border border-stone-200 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors text-stone-600 cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Resolution Deadline
              </label>
              <input
                type="datetime-local"
                required
                value={pvpDeadline}
                onChange={(e) => setPvpDeadline(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker()
                  } catch (err) {}
                }}
                className="w-full h-11 px-3 border border-stone-200 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors text-stone-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Resolution Source */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Resolution Oracle Source
            </label>
            <input
              type="text"
              required
              placeholder="World Cup Match Stats API"
              value={pvpResolutionSource}
              onChange={(e) => setPvpResolutionSource(e.target.value)}
              className="w-full h-11 px-3 border border-stone-200 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Category selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Market Propositions
              </span>
              <span
                className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                  generatedOptions.length >= 3
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {generatedOptions.length} propositions
              </span>
            </div>

            {/* Match Winner */}
            <CategoryCard
              title="Match Winner"
              subtitle="Win / Draw / Win"
              icon={<Trophy className="h-4 w-4" />}
              enabled={categories.winner.enabled}
              onToggle={() => toggleCategory("winner")}
              accentColor="indigo"
            >
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-indigo-50/50 border border-indigo-100">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Home
                  </span>
                  <span className="text-xs font-bold text-indigo-700 text-center leading-tight">
                    {hasTeams ? teamA : "Team A"}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Draw
                  </span>
                  <span className="text-xs font-bold text-stone-600 text-center leading-tight">
                    Draw
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Away
                  </span>
                  <span className="text-xs font-bold text-rose-700 text-center leading-tight">
                    {hasTeams ? teamB : "Team B"}
                  </span>
                </div>
              </div>
            </CategoryCard>

            {/* First Team to Score */}
            <CategoryCard
              title="First Team to Score"
              subtitle="Team A / No Goal / Team B"
              icon={<Target className="h-4 w-4" />}
              enabled={categories.firstScore.enabled}
              onToggle={() => toggleCategory("firstScore")}
              accentColor="amber"
            >
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-amber-50/30 border border-amber-100">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Home
                  </span>
                  <span className="text-xs font-bold text-amber-700 text-center leading-tight">
                    {hasTeams ? teamA : "Team A"}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    No Goal
                  </span>
                  <span className="text-xs font-bold text-stone-600 text-center leading-tight">
                    No Goal
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Away
                  </span>
                  <span className="text-xs font-bold text-rose-700 text-center leading-tight">
                    {hasTeams ? teamB : "Team B"}
                  </span>
                </div>
              </div>
            </CategoryCard>

            {/* Red Card */}
            <CategoryCard
              title="Red Card"
              subtitle="Red card shown in match"
              icon={<ShieldAlert className="h-4 w-4" />}
              enabled={categories.redCard.enabled}
              onToggle={() => toggleCategory("redCard")}
              accentColor="yellow"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-yellow-50/30 border border-yellow-100">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Yes
                  </span>
                  <span className="text-xs font-bold text-yellow-700 text-center leading-tight">
                    Red card shown
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    No
                  </span>
                  <span className="text-xs font-bold text-stone-600 text-center leading-tight">
                    No red cards
                  </span>
                </div>
              </div>
            </CategoryCard>

            {/* Corners */}
            <CategoryCard
              title="Corners"
              subtitle={`Over / Under ${categories.corners.line}`}
              icon={<Flag className="h-4 w-4" />}
              enabled={categories.corners.enabled}
              onToggle={() => toggleCategory("corners")}
              accentColor="emerald"
            >
              <div className="space-y-2">
                <span className="block text-[9px] font-bold uppercase text-stone-400">
                  Select line
                </span>
                <div className="flex gap-1.5">
                  {CORNER_LINES.map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => setCategoryLine("corners", line)}
                      className={`flex-1 h-8 rounded text-xs font-bold transition-all border ${
                        categories.corners.line === line
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white border-stone-200 text-stone-600 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer"
                      }`}
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>
            </CategoryCard>

            {/* Goals */}
            <CategoryCard
              title="Goals"
              subtitle={`Over / Under ${categories.goals.line}`}
              icon={<Target className="h-4 w-4" />}
              enabled={categories.goals.enabled}
              onToggle={() => toggleCategory("goals")}
              accentColor="amber"
            >
              <div className="space-y-2">
                <span className="block text-[9px] font-bold uppercase text-stone-400">
                  Select line
                </span>
                <div className="flex gap-1.5">
                  {GOAL_LINES.map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => setCategoryLine("goals", line)}
                      className={`flex-1 h-8 rounded text-xs font-bold transition-all border ${
                        categories.goals.line === line
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-white border-stone-200 text-stone-600 hover:border-amber-400 hover:text-amber-600 cursor-pointer"
                      }`}
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>
            </CategoryCard>

            {/* Yellow Cards */}
            <CategoryCard
              title="Yellow Cards"
              subtitle={`Over / Under ${categories.cards.line}`}
              icon={<AlertTriangle className="h-4 w-4" />}
              enabled={categories.cards.enabled}
              onToggle={() => toggleCategory("cards")}
              accentColor="yellow"
            >
              <div className="space-y-2">
                <span className="block text-[9px] font-bold uppercase text-stone-400">
                  Select line
                </span>
                <div className="flex gap-1.5">
                  {CARD_LINES.map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => setCategoryLine("cards", line)}
                      className={`flex-1 h-8 rounded text-xs font-bold transition-all border ${
                        categories.cards.line === line
                          ? "bg-yellow-500 text-white border-yellow-500 shadow-xs"
                          : "bg-white border-stone-200 text-stone-600 hover:border-yellow-400 hover:text-yellow-600 cursor-pointer"
                      }`}
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>
            </CategoryCard>

            {/* Both Teams to Score */}
            <CategoryCard
              title="Both Teams to Score"
              subtitle="Both Teams to Score - Yes / No"
              icon={<Target className="h-4 w-4" />}
              enabled={categories.btts?.enabled}
              onToggle={() => toggleCategory("btts")}
              accentColor="indigo"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-indigo-50/30 border border-indigo-100">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    Yes
                  </span>
                  <span className="text-xs font-bold text-indigo-700 text-center leading-tight">
                    Yes (BTTS)
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-stone-50 border border-stone-200">
                  <span className="text-[9px] font-bold uppercase text-stone-400">
                    No
                  </span>
                  <span className="text-xs font-bold text-stone-600 text-center leading-tight">
                    No (BTTS)
                  </span>
                </div>
              </div>
            </CategoryCard>

            {/* Offsides */}
            <CategoryCard
              title="Offsides"
              subtitle={`Over / Under ${categories.offsides?.line}`}
              icon={<Flag className="h-4 w-4" />}
              enabled={categories.offsides?.enabled}
              onToggle={() => toggleCategory("offsides")}
              accentColor="emerald"
            >
              <div className="space-y-2">
                <span className="block text-[9px] font-bold uppercase text-stone-400">
                  Select line
                </span>
                <div className="flex gap-1.5">
                  {OFFSIDE_LINES.map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => setCategoryLine("offsides", line)}
                      className={`flex-1 h-8 rounded text-xs font-bold transition-all border ${
                        categories.offsides?.line === line
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white border-stone-200 text-stone-600 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer"
                      }`}
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>
            </CategoryCard>

            {/* Custom options */}
            <div className="rounded-xl border border-dashed border-stone-200 p-3 space-y-2.5 bg-stone-50/30">
              <span className="block text-[10px] font-bold uppercase text-stone-500">
                Custom Propositions
              </span>
              {customOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customOptions.map((opt, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-[11px] font-medium text-stone-700"
                    >
                      {opt}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomOption(idx)}
                        className="text-stone-400 hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type custom proposition..."
                  value={customOptionText}
                  onChange={(e) => setCustomOptionText(e.target.value)}
                  className="flex-1 h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddCustomOption}
                  className="px-3 h-9 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-indigo-100 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Deploy estimates preview */}
          {generatedOptions.length > 0 && adminBalances && (
            <div className="rounded-xl bg-indigo-50/50 border border-indigo-100 p-3 text-[11px] text-indigo-950 flex flex-col gap-1">
              <span className="font-bold uppercase text-[9px] text-indigo-700 tracking-wider">
                Deploy Estimates
              </span>
              <div>
                Deployment will create{" "}
                <strong className="font-semibold text-indigo-900">
                  {generatedOptions.length} markets
                </strong>
                .
              </div>
              <div>
                Pre-deposit balance required:{" "}
                <strong className="font-extrabold text-indigo-900">
                  {(
                    adminBalances.preDepositUsdcPerOption *
                    generatedOptions.length
                  ).toFixed(2)}{" "}
                  USDC
                </strong>
                .
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 border border-stone-200 text-stone-700 text-xs font-semibold uppercase tracking-wider rounded-lg cursor-pointer transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || generatedOptions.length < 3}
              className="flex-2 h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold uppercase tracking-wider rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading
                ? "Deploying..."
                : `Deploy Matchup & ${generatedOptions.length} Options`}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

/* CategoryCard inline utility */
interface CategoryCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  enabled: boolean
  onToggle: () => void
  accentColor: string
  children: React.ReactNode
}

function CategoryCard({
  title,
  subtitle,
  icon,
  enabled,
  onToggle,
  accentColor,
  children,
}: CategoryCardProps) {
  const colorMap: Record<
    string,
    { bg: string; border: string; text: string; toggle: string }
  > = {
    indigo: {
      bg: "bg-indigo-50/50",
      border: "border-indigo-250",
      text: "text-indigo-600",
      toggle: "bg-indigo-600",
    },
    emerald: {
      bg: "bg-emerald-50/50",
      border: "border-emerald-250",
      text: "text-emerald-600",
      toggle: "bg-emerald-600",
    },
    amber: {
      bg: "bg-amber-50/50",
      border: "border-amber-250",
      text: "text-amber-600",
      toggle: "bg-amber-500",
    },
    yellow: {
      bg: "bg-yellow-50/50",
      border: "border-yellow-250",
      text: "text-yellow-600",
      toggle: "bg-yellow-500",
    },
  }

  const colors = colorMap[accentColor] || colorMap.indigo

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        enabled ? `${colors.bg} ${colors.border}` : "border-stone-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 gap-3 cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              enabled
                ? `${colors.toggle} text-white shadow-xs`
                : "bg-stone-100 text-stone-400 group-hover:text-stone-600"
            }`}
          >
            {icon}
          </div>
          <div className="text-left min-w-0">
            <span className="block text-sm font-bold text-stone-900 leading-tight">
              {title}
            </span>
            <span className="block text-[10px] text-stone-400 font-mono truncate mt-0.5">
              {subtitle}
            </span>
          </div>
        </div>

        <div
          className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${
            enabled ? colors.toggle : "bg-stone-200"
          }`}
        >
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </div>
      </button>

      <div
        className={`transition-all overflow-hidden ${
          enabled ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  )
}
