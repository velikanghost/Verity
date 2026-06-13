"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Lock } from "lucide-react"

// Country flag helper
export function getCountryFlag(name: string): string {
  const clean = name.toLowerCase().trim()
  const map: Record<string, string> = {
    "south korea": "🇰🇷",
    "south-korea": "🇰🇷",
    "korea": "🇰🇷",
    "denmark": "🇩🇰",
    "poland": "🇵🇱",
    "netherlands": "🇳🇱",
    "france": "🇫🇷",
    "england": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    "wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    "ghana": "🇬🇭",
    "tunisia": "🇹🇳",
    "saudi arabia": "🇸🇦",
    "ecuador": "🇪🇨",
    "honduras": "🇭🇳",
    "canada": "🇨🇦",
    "usa": "🇺🇸",
    "united states": "🇺🇸",
    "iran": "🇮🇷",
    "spain": "🇪🇸",
    "germany": "🇩🇪",
    "italy": "🇮🇹",
    "argentina": "🇦🇷",
    "brazil": "🇧🇷",
    "portugal": "🇵🇹",
    "belgium": "🇧🇪",
    "croatia": "🇭🇷",
    "uruguay": "🇺🇾",
    "senegal": "🇸🇳",
    "morocco": "🇲🇦",
    "switzerland": "🇨🇭",
    "cameroon": "🇨🇲",
    "serbia": "🇷🇸",
    "mexico": "🇲🇽",
    "australia": "🇦🇺",
    "costa rica": "🇨🇷",
    "japan": "🇯🇵",
    "qatar": "🇶🇦",
  }
  return map[clean] || "🏳️"
}

// Helper to parse question into team names
export function parseEventTeams(question: string) {
  const vsMatch = question.match(/(.+?)\s+vs\.?\s+(.+)/i)
  if (vsMatch) return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() }
  const dashMatch = question.match(/(.+?)\s+-\s+(.+)/)
  if (dashMatch)
    return { teamA: dashMatch[1].trim(), teamB: dashMatch[2].trim() }
  return { teamA: "Team A", teamB: "Team B" }
}

interface PvpMatchupCarouselProps {
  pvpEvents: any[]
  selectedPvpEventId: string | null
  setSelectedPvpEventId: (id: string | null) => void
}

export default function PvpMatchupCarousel({
  pvpEvents,
  selectedPvpEventId,
  setSelectedPvpEventId,
}: PvpMatchupCarouselProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Calculate live/remaining time label
  const getCardTimeStatus = (evt: any) => {
    const lockTimeStr = evt.lockTime || evt.deadline
    if (!lockTimeStr) return { isClosed: true, label: "CLOSED" }

    const target = new Date(lockTimeStr)
    if (isNaN(target.getTime())) return { isClosed: true, label: "CLOSED" }

    const diff = target.getTime() - Date.now()
    const isClosed =
      diff <= 0 || evt.status === "resolved" || evt.status === "closed"

    if (isClosed) {
      return { isClosed: true, label: "CLOSED" }
    }

    const diffHrs = Math.floor(diff / (1000 * 60 * 60))
    const diffMins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const diffDays = Math.floor(diffHrs / 24)

    if (diffDays > 0) {
      const remainingHrs = diffHrs % 24
      return { isClosed: false, label: `LIVE · ${diffDays}D ${remainingHrs}H` }
    }
    return { isClosed: false, label: `LIVE · ${diffHrs}H ${diffMins}M` }
  }

  // Calculate volume
  const getEventVolume = (evt: any) => {
    if (!evt?.options) return 0
    return evt.options.reduce(
      (sum: number, opt: any) => sum + Number(opt.liquidity ?? 0),
      0,
    )
  }

  // Format date/time
  const formatEventDate = (evt: any) => {
    const timeStr = evt.lockTime || evt.deadline
    if (!timeStr) return ""
    const date = new Date(timeStr)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const selectedRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll selected card into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [selectedPvpEventId])

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!pvpEvents) return []
    return pvpEvents.filter((evt) => {
      const query = searchQuery.toLowerCase().trim()
      if (!query) return true
      return evt.question.toLowerCase().includes(query)
    })
  }, [pvpEvents, searchQuery])

  return (
    <div className="flex flex-col gap-4">
      {/* Search Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-charcoal-primary dark:text-white">
            Select matchup
          </h2>
          <p className="text-xs text-ash">Scroll, search, or tap a card.</p>
        </div>

        {/* Search input with Rounded Border */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-4 pr-10 border border-border dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-xs rounded-full text-charcoal-primary dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ash" />
        </div>
      </div>

      {/* Horizontal Scroll Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar -mx-1 px-1">
        {filteredEvents.length === 0 ? (
          <div className="w-full text-center py-6 text-xs font-mono text-ash border border-dashed border-border dark:border-zinc-800 rounded-xl bg-white/30 dark:bg-zinc-900/10">
            No matchups found.
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isSelected = selectedPvpEventId
              ? evt.id === selectedPvpEventId
              : pvpEvents[0]?.id === evt.id

            const { isClosed, label: statusLabel } = getCardTimeStatus(evt)
            const vol = getEventVolume(evt)
            const formattedDate = formatEventDate(evt)
            const { teamA, teamB } = parseEventTeams(evt.question)

            return (
              <div
                key={evt.id}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => setSelectedPvpEventId(evt.id)}
                className={`relative flex-none w-68 h-40 p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#121212] border-[#121212] dark:bg-white dark:border-white text-white dark:text-zinc-950 shadow-lg scale-[1.01]"
                    : "bg-white dark:bg-zinc-900/40 border-border dark:border-zinc-800 hover:border-indigo-500 hover:scale-[1.005]"
                } ${isClosed && !isSelected ? "opacity-75" : ""}`}
              >
                {/* Top Badge Row */}
                <div className="flex items-center justify-between">
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider ${
                      isClosed
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        : isSelected
                          ? "bg-zinc-800/80 text-white"
                          : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isClosed ? (
                      <>
                        <Lock className="h-2.5 w-2.5" />
                        {statusLabel}
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {statusLabel}
                      </>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? "text-zinc-400" : "text-ash"}`}>
                    ${vol.toLocaleString()}
                  </span>
                </div>

                {/* Teams/Flags Content */}
                <div className="flex items-center justify-between gap-2 my-2">
                  <div className="flex flex-col items-center flex-1 text-center min-w-0">
                    <span className="text-xl" title={teamA}>
                      {getCountryFlag(teamA)}
                    </span>
                    <span className="text-xs font-bold leading-snug truncate w-full mt-1.5">
                      {teamA}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono font-semibold opacity-50 px-1 shrink-0">
                    vs
                  </span>

                  <div className="flex flex-col items-center flex-1 text-center min-w-0">
                    <span className="text-xl" title={teamB}>
                      {getCountryFlag(teamB)}
                    </span>
                    <span className="text-xs font-bold leading-snug truncate w-full mt-1.5">
                      {teamB}
                    </span>
                  </div>
                </div>

                {/* Footer Details */}
                <div className="flex items-center justify-between text-[9px] font-mono border-t border-dashed border-zinc-200/20 dark:border-zinc-800/50 pt-2 shrink-0">
                  <span className={isSelected ? "text-zinc-400" : "text-ash"}>
                    {formattedDate}
                  </span>
                  <span className={isSelected ? "text-zinc-400" : "text-ash"}>
                    Min. 3 picks
                  </span>
                </div>

                {/* Selected Check Badge Badge */}
                {isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 bg-[#FF3E00] text-white h-5 w-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white dark:ring-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-2.5 w-2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
