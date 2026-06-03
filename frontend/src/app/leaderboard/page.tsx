"use client"

import { useState } from "react"
import { usePvpLeaderboardQuery } from "@/store/verity/verityQueries"
import { Trophy, Zap, Users, Info, CircleHelp, Medal } from "lucide-react"
import Link from "next/link"

type LeaderboardTab = "elo" | "xp" | "referrers" | "points-system"

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("elo")
  const { data: leaderboardData, isLoading, error } = usePvpLeaderboardQuery()

  const pointsDraft = [
    {
      role: "Free voters",
      logic: "+10 pts for every correct resolved free prediction. +0 for incorrect predictions.",
    },
    {
      role: "Free vote eligibility",
      logic: "User must hold 10 USDC for 24 hours to unlock 10 free votes for the next 24 hours.",
    },
    {
      role: "Referrals",
      logic: "+5 pts per qualified referral + 10% of the referred user's weekly points for their first 4 weeks.",
    },
    {
      role: "Market creators",
      logic: "+100 pts for creating a valid market. +100 pts if the market becomes active / bonds.",
    },
    {
      role: "Traders",
      logic: "Points based on trading volume and fees generated. Gets a 1.2x boost if they voted on the market before it bonded.",
    },
    {
      role: "Seeders",
      logic: "Seeders share a fixed 500-point pool pro rata for each market that successfully bonds.",
    },
    {
      role: "LP providers",
      logic: "Points depend on liquidity contribution, time provided, and the market's volume/fees after bonding.",
    },
  ]

  return (
    <div className="flex flex-col gap-4 py-4 max-w-[672px] mx-auto">
      {/* Header Banner */}
      <section className="verity-card relative overflow-hidden p-5 sm:p-6 bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-transparent dark:from-indigo-950/10 dark:via-purple-950/5">
        <div className="absolute -right-3 -top-3 h-24 w-24 rounded-full bg-indigo-500/10" />
        <div className="relative max-w-[480px]">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">
            Rankings & Rep
          </p>
          <h1 className="text-[32px] font-semibold leading-[1.06] tracking-[-0.7px] text-midnight dark:text-white sm:text-[40px]">
            The Verity Leaderboard
          </h1>
          <p className="mt-3 text-[14px] leading-[1.47] tracking-[-0.2px] text-graphite dark:text-zinc-400">
            See where you rank in skill ELO, prediction volume, and referral contribution.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-border dark:border-zinc-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("elo")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium tracking-tight whitespace-nowrap transition-colors ${
            activeTab === "elo"
              ? "border-charcoal-primary text-charcoal-primary dark:border-white dark:text-white"
              : "border-transparent text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          <Trophy className="h-4 w-4" />
          Skill ELO
        </button>
        <button
          onClick={() => setActiveTab("xp")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium tracking-tight whitespace-nowrap transition-colors ${
            activeTab === "xp"
              ? "border-charcoal-primary text-charcoal-primary dark:border-white dark:text-white"
              : "border-transparent text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          <Zap className="h-4 w-4" />
          XP Volume
        </button>
        <button
          onClick={() => setActiveTab("referrers")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium tracking-tight whitespace-nowrap transition-colors ${
            activeTab === "referrers"
              ? "border-charcoal-primary text-charcoal-primary dark:border-white dark:text-white"
              : "border-transparent text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          <Users className="h-4 w-4" />
          Top Referrers
        </button>
        <button
          onClick={() => setActiveTab("points-system")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium tracking-tight whitespace-nowrap transition-colors ${
            activeTab === "points-system"
              ? "border-charcoal-primary text-charcoal-primary dark:border-white dark:text-white"
              : "border-transparent text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          <Info className="h-4 w-4" />
          Points System Draft
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 min-h-[350px]">
        {isLoading && (
          <div className="verity-card p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-charcoal-primary dark:border-white" />
            <p className="text-sm text-ash font-mono">Loading rankings...</p>
          </div>
        )}

        {error && (
          <div className="verity-card p-8 text-center text-sm text-coral-red">
            Failed to load leaderboard data: {error.message}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {activeTab === "elo" && (
              <div className="verity-card overflow-hidden">
                <div className="p-4 border-b border-border dark:border-zinc-800 bg-white-surface/40 dark:bg-zinc-900/40">
                  <h3 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white">ELO Skill Leaderboard</h3>
                  <p className="text-xs text-ash mt-0.5">Ranked by head-to-head match prediction ELO rating.</p>
                </div>
                {leaderboardData?.elo?.length === 0 ? (
                  <div className="p-8 text-center text-sm text-ash">No rankings available yet.</div>
                ) : (
                  <div className="divide-y divide-border dark:divide-zinc-800">
                    {leaderboardData?.elo?.map((user: any, index: number) => (
                      <UserLeaderboardRow
                        key={user.id}
                        user={user}
                        rank={index + 1}
                        scoreLabel="ELO"
                        scoreValue={user.eloRating}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "xp" && (
              <div className="verity-card overflow-hidden">
                <div className="p-4 border-b border-border dark:border-zinc-800 bg-white-surface/40 dark:bg-zinc-900/40">
                  <h3 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white">XP Volume Leaderboard</h3>
                  <p className="text-xs text-ash mt-0.5">Ranked by total accumulated Arena XP.</p>
                </div>
                {leaderboardData?.xp?.length === 0 ? (
                  <div className="p-8 text-center text-sm text-ash">No rankings available yet.</div>
                ) : (
                  <div className="divide-y divide-border dark:divide-zinc-800">
                    {leaderboardData?.xp?.map((user: any, index: number) => (
                      <UserLeaderboardRow
                        key={user.id}
                        user={user}
                        rank={index + 1}
                        scoreLabel="XP"
                        scoreValue={user.arenaXp}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "referrers" && (
              <div className="verity-card overflow-hidden">
                <div className="p-4 border-b border-border dark:border-zinc-800 bg-white-surface/40 dark:bg-zinc-900/40">
                  <h3 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white">Top Referrers</h3>
                  <p className="text-xs text-ash mt-0.5">Ranked by total number of referred onboarded users.</p>
                </div>
                {leaderboardData?.referrers?.length === 0 ? (
                  <div className="p-8 text-center text-sm text-ash">No referrals recorded yet.</div>
                ) : (
                  <div className="divide-y divide-border dark:divide-zinc-800">
                    {leaderboardData?.referrers?.map((user: any, index: number) => (
                      <UserLeaderboardRow
                        key={user.id}
                        user={user}
                        rank={index + 1}
                        scoreLabel="Referrals"
                        scoreValue={user.referralCount}
                        extraInfo={`(${user.arenaXp} XP)`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "points-system" && (
              <div className="flex flex-col gap-3">
                <div className="verity-card p-5 bg-gradient-to-br from-indigo-50/20 to-transparent dark:from-indigo-950/5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <Medal className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-charcoal-primary dark:text-white">
                        System-wide Points Draft
                      </h3>
                      <p className="text-sm text-graphite dark:text-zinc-400 mt-1">
                        Here is the point award schema designed to gamify predictions and rewards across the entire Verity platform.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="verity-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border dark:border-zinc-800 bg-white-surface/40 dark:bg-zinc-900/40 text-xs font-mono font-bold uppercase tracking-wider text-ash">
                          <th className="p-4 w-[160px]">Activity</th>
                          <th className="p-4">Reward Logic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border dark:divide-zinc-800">
                        {pointsDraft.map((item) => (
                          <tr key={item.role} className="hover:bg-white-surface/20 dark:hover:bg-zinc-900/20">
                            <td className="p-4 font-semibold text-charcoal-primary dark:text-white align-top">
                              {item.role}
                            </td>
                            <td className="p-4 text-graphite dark:text-zinc-300 leading-relaxed">
                              {item.logic}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function UserLeaderboardRow({
  user,
  rank,
  scoreLabel,
  scoreValue,
  extraInfo,
}: {
  user: any
  rank: number
  scoreLabel: string
  scoreValue: number
  extraInfo?: string
}) {
  const isTopThree = rank <= 3
  const rankColors = [
    "bg-amber-400 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300", // Gold
    "bg-zinc-300 text-zinc-950 dark:bg-zinc-700/30 dark:text-zinc-300",    // Silver
    "bg-amber-600 text-amber-50 dark:bg-amber-700/20 dark:text-amber-400",  // Bronze
  ]

  const eloTiers = (elo: number) => {
    if (elo < 1100) return { name: "Bronze", color: "text-amber-700 bg-amber-500/10" }
    if (elo < 1300) return { name: "Silver", color: "text-zinc-400 bg-zinc-500/10" }
    if (elo < 1500) return { name: "Gold", color: "text-amber-500 bg-amber-500/10" }
    if (elo < 1700) return { name: "Platinum", color: "text-cyan-400 bg-cyan-500/10" }
    if (elo < 1900) return { name: "Diamond", color: "text-indigo-400 bg-indigo-500/10" }
    return { name: "Legend", color: "text-purple-400 bg-purple-500/10 font-bold" }
  }

  const tier = scoreLabel === "ELO" ? eloTiers(scoreValue) : null

  return (
    <div className="flex items-center justify-between p-4 hover:bg-white-surface/20 dark:hover:bg-zinc-900/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Rank Number */}
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold font-mono ${
            isTopThree ? rankColors[rank - 1] : "text-ash"
          }`}
        >
          {rank}
        </span>

        {/* User Details */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 relative flex items-center justify-center font-bold text-zinc-500">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.username}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              (user.displayName || user.username || "?").charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/profile/${encodeURIComponent(user.id)}`}
              className="block text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white truncate hover:underline"
            >
              {user.displayName || user.username}
            </Link>
            <span className="block text-xs font-mono text-ash truncate">
              @{user.username}
            </span>
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 shrink-0">
        {tier && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase font-mono ${tier.color}`}>
            {tier.name}
          </span>
        )}
        <div className="text-right">
          <span className="font-semibold text-sm text-charcoal-primary dark:text-white font-mono">
            {scoreValue}
          </span>
          <span className="text-[10px] text-ash font-mono uppercase tracking-wider block leading-none mt-0.5">
            {scoreLabel} {extraInfo}
          </span>
        </div>
      </div>
    </div>
  )
}
