"use client"

import React, { useState, useEffect } from "react"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import {
  useMissionsQuery,
  useLinkTwitterMutation,
  useCompleteMissionMutation,
} from "@/store/verity/verityQueries"
import { Send, X, Loader2 } from "lucide-react"
import toast from "@/lib/toast"

export default function MissionsPage() {
  const { profile } = useWalletProfile()
  const { data: missions, isLoading: isMissionsLoading } = useMissionsQuery()
  const { mutateAsync: linkTwitter, isPending: isLinking } =
    useLinkTwitterMutation()
  const { mutateAsync: completeMission } = useCompleteMissionMutation()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [twitterInput, setTwitterInput] = useState("")
  const [verifyingMissionId, setVerifyingMissionId] = useState<string | null>(
    null,
  )

  // Retrieve started missions from localStorage to persist state across reloads/redirects
  const [startedMissions, setStartedMissions] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("verity_started_missions")
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })

  useEffect(() => {
    localStorage.setItem(
      "verity_started_missions",
      JSON.stringify(startedMissions),
    )
  }, [startedMissions])

  const handleLinkTwitter = async () => {
    const trimmed = twitterInput.trim().replace(/^@/, "")
    if (!trimmed) {
      toast.error("Please enter a valid X/Twitter username.")
      return
    }

    try {
      await linkTwitter({ twitterUsername: trimmed })
      toast.success("X account linked!")
      setIsModalOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to link X account.",
      )
    }
  }

  const handleStart = (missionId: string, actionUrl: string) => {
    window.open(actionUrl, "_blank", "noopener,noreferrer")
    if (!startedMissions.includes(missionId)) {
      setStartedMissions((prev) => [...prev, missionId])
    }
  }

  const handleClaim = async (
    missionId: string,
    verificationKey: string | null | undefined,
  ) => {
    if (verificationKey?.startsWith("twitter_") && !profile?.twitterUsername) {
      toast.error("Please link your X account first.")
      // Revert button state back to "Start" since linking is required first
      setStartedMissions((prev) => prev.filter((id) => id !== missionId))
      setTwitterInput("")
      setIsModalOpen(true)
      return
    }

    setVerifyingMissionId(missionId)
    try {
      await completeMission(missionId)
      toast.success("Mission completed!")
      setVerifyingMissionId(null)
      // Cleanup local started tracking once successfully completed on backend
      setStartedMissions((prev) => prev.filter((id) => id !== missionId))
    } catch (err: any) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Verification failed. Please try again.",
      )
      setVerifyingMissionId(null)
      // Revert button state back to "Start"
      setStartedMissions((prev) => prev.filter((id) => id !== missionId))
    }
  }

  // Dynamic descriptions for missions based on verificationKey
  const getMissionDescription = (
    verificationKey: string | null | undefined,
    title: string,
  ): string => {
    switch (verificationKey) {
      case "has_voted":
        return "Place a vote on any active prediction market."
      case "has_commented":
        return "Post a comment on any market feed."
      case "has_liked":
        return "Like any post or market in the feed."
      case "has_traded":
        return "Place a trade (buy shares) on any open match today."
      case "has_added_liquidity":
        return "Provide liquidity to any market pool."
      case "has_created_market":
        return "Propose and create a new prediction market."
      case "has_set_profile":
        return "Complete your profile onboarding."
      case "twitter_follow":
        return "Follow the target account on X/Twitter."
      case "twitter_retweet":
        return "Repost the specified post on X/Twitter."
      case "twitter_comment":
        return "Reply to the specified post on X/Twitter."
      case "twitter_retweet_and_comment":
        return "Repost and reply to the specified post on X/Twitter."
      default:
        return title
          ? `Complete the required activity for ${title}.`
          : "Complete this activity to earn rewards."
    }
  }

  return (
    <div className="w-full max-w-[1240px] mx-auto py-4 font-sans flex flex-col gap-6">
      {/* Top Header Card */}
      <section className="verity-card relative overflow-hidden p-5 flex flex-col sm:flex-row justify-between items-center gap-6">
        {/* Background shapes rhyming with Home */}
        <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-sunburst-yellow/30 dark:bg-sunburst-yellow/10" />
        <div className="absolute right-32 top-7 hidden sm:block">
          <span className="verity-blob block h-12 w-14 rotate-6 bg-sky-blue">
            <span className="verity-blob-smile" />
          </span>
        </div>

        <div className="relative z-10 flex-1 space-y-2 text-center sm:text-left pr-0 sm:pr-4">
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ember-orange">
            Missions
          </p>
          <h1 className="text-[30px] font-semibold leading-[1.06] tracking-[-0.7px] text-midnight dark:text-white sm:text-[44px] sm:tracking-[-1.14px]">
            Earn More XP.
          </h1>
          <p className="mt-3 text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite dark:text-zinc-400 max-w-xl mx-auto sm:mx-0">
            Complete quick social and platform activities to earn extra XP.
          </p>
        </div>

        {/* Current XP & Linked Twitter Info */}
        <div className="relative z-10 flex flex-col items-center sm:items-end gap-3 shrink-0 w-full sm:w-auto">
          {/* Current XP Stat Box */}
          <div className="rounded-2xl bg-[#FAF9F6] dark:bg-zinc-900/40 px-6 py-4 border border-stone-200/20 dark:border-zinc-850/10 shadow-inner flex flex-col items-center shrink-0 w-full sm:w-auto min-w-[180px]">
            <span className="text-[10px] font-mono text-ash uppercase font-bold tracking-wider flex items-center gap-1.5">
              Total XP
            </span>
            <strong className="text-4xl font-bold font-family text-[#FF4D00] block mt-1">
              {profile?.arenaXp ?? 0}
            </strong>
          </div>

          {profile?.twitterUsername ? (
            <div className="text-[10px] font-mono text-ash flex items-center gap-1.5 bg-[#FAF9F6] dark:bg-zinc-900/40 border border-stone-200/20 dark:border-zinc-850/10 px-3 py-1.5 rounded-xl">
              <Send className="h-3 w-3 text-indigo-500" />
              <span>X: @{profile.twitterUsername}</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setTwitterInput("")
                setIsModalOpen(true)
              }}
              className="text-[10px] font-mono text-ember-orange hover:bg-ember-orange/10 transition-colors flex items-center gap-1.5 bg-[#FAF9F6] dark:bg-zinc-900/40 border border-stone-200/20 dark:border-zinc-850/10 px-3.5 py-2 rounded-xl cursor-pointer font-semibold outline-none"
            >
              <Send className="h-3 w-3 text-ember-orange" />
              <span>Link X Username</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Missions Area */}
      {isMissionsLoading ? (
        <div className="flex flex-col gap-4 w-full animate-pulse">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="verity-card h-20 bg-stone-200/20 dark:bg-zinc-900/10 rounded-2xl"
            />
          ))}
        </div>
      ) : !missions || missions.length === 0 ? (
        /* Empty State (Coming Soon Component) */
        <div className="verity-card border border-dashed border-border dark:border-zinc-800 rounded-2xl bg-white-surface/40 dark:bg-zinc-900/10 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden">
          <div className="absolute -left-16 -bottom-16 w-36 h-36 rounded-full bg-sky-blue/10 blur-2xl pointer-events-none" />
          <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-ember-orange/10 blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-md animate-pulse" />
            <span className="verity-blob block h-16 w-20 bg-sunburst-yellow relative z-10 landing-float">
              <span className="verity-blob-smile" />
            </span>
          </div>

          <div className="max-w-md relative z-10 space-y-2 mt-4">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-midnight dark:text-white">
              Missions Coming Soon
            </h2>
            <p className="text-sm text-graphite dark:text-zinc-400 leading-relaxed">
              Check back soon to complete tasks, verify your social actions, and
              accumulate XP!
            </p>
          </div>
        </div>
      ) : (
        /* Missions List Grid */
        <div className="flex flex-col gap-3.5 w-full">
          {missions.map((mission) => {
            const isCompleted = mission.completed
            const isStarted = startedMissions.includes(mission.id)

            // Dot color logic: Grey if completed, green if started/claimable, orange if unstarted
            let dotColor = "bg-[#FF4D00]" // orange
            if (isCompleted) {
              dotColor = "bg-stone-300 dark:bg-zinc-700"
            } else if (isStarted) {
              dotColor = "bg-[#00E35B]" // green
            }

            return (
              <div
                key={mission.id}
                className="verity-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 md:p-5 bg-white-surface border border-stone-200/40 dark:border-zinc-800/40 shadow-sm rounded-2xl transition-all duration-200 hover:shadow-md"
              >
                {/* Left Section: Status Dot & Title Details */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1.5 ${dotColor}`}
                  />
                  <div className="flex flex-col min-w-0">
                    <h3
                      className={`text-base font-semibold tracking-tight leading-snug ${
                        isCompleted
                          ? "text-ash line-through opacity-60"
                          : "text-midnight dark:text-white"
                      }`}
                    >
                      {mission.title}
                    </h3>
                    <p className="text-sm text-graphite dark:text-zinc-400 mt-0.5 leading-normal">
                      {getMissionDescription(
                        mission.verificationKey,
                        mission.title,
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Section: Rewards & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 w-full sm:w-auto pt-3 sm:pt-0 border-t border-stone-100 dark:border-zinc-800/20 sm:border-none">
                  {/* Reward Label */}
                  <span
                    className={`text-base font-bold tracking-tight ${
                      isCompleted
                        ? "text-ash font-medium opacity-60"
                        : "text-[#FF4D00]"
                    }`}
                  >
                    {mission.xpReward && mission.xpReward > 0
                      ? `+${mission.xpReward} XP`
                      : mission.rewardMultiplier
                        ? `+${mission.rewardMultiplier}x Boost`
                        : null}
                  </span>

                  {/* Actions (Claim / Start / Completed) */}
                  {isCompleted ? (
                    <span className="text-sm font-semibold text-ash font-mono select-none px-2 py-1">
                      Completed
                    </span>
                  ) : isStarted ? (
                    <button
                      onClick={() =>
                        handleClaim(mission.id, mission.verificationKey)
                      }
                      disabled={verifyingMissionId === mission.id}
                      className="flex h-8 px-5 items-center justify-center bg-black dark:bg-white text-white dark:text-black rounded-full font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {verifyingMissionId === mission.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Claim"
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(mission.id, mission.actionUrl)}
                      className="text-[#FF4D00] hover:underline font-semibold text-sm bg-transparent border-none outline-none cursor-pointer p-1"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Twitter Linking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/35 px-4 py-6 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop overlay */}
          <div
            className="absolute inset-0"
            onClick={() => !isLinking && setIsModalOpen(false)}
          />

          {/* Modal Card */}
          <div className="verity-card relative z-10 w-full max-w-[420px] flex flex-col overflow-hidden bg-white-surface p-6 shadow-2xl border border-stone-200/40 dark:border-zinc-800/40 animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-stone-surface">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ash flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-indigo-500" />
                Link X Account
              </span>
              <button
                aria-label="Close"
                disabled={isLinking}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-parchment-card text-charcoal-primary shadow-subtle transition-colors hover:bg-stone-surface disabled:opacity-50"
                onClick={() => setIsModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Warning / Caution */}
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-400 leading-relaxed font-sans">
              <strong>⚠️ Permanency Warning</strong>: This username cannot be
              changed or edited once set. Please verify that it is correct.
            </div>

            {/* Input field */}
            <div className="mt-5 space-y-1.5 text-left">
              <label className="text-xs font-semibold text-charcoal-primary font-mono block">
                X/Twitter Username
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-sm text-ash font-mono select-none">
                  @
                </span>
                <input
                  type="text"
                  placeholder="username"
                  value={twitterInput}
                  onChange={(e) => setTwitterInput(e.target.value)}
                  disabled={isLinking}
                  className="pl-7 h-10 w-full rounded-xl border border-stone-200 dark:border-zinc-850 bg-transparent text-sm text-midnight dark:text-white placeholder-ash outline-none focus:border-[#FF4D00] dark:focus:border-ember-orange transition-colors"
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-dashed border-stone-surface">
              <button
                type="button"
                disabled={isLinking}
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-charcoal-primary hover:bg-stone-surface rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLinking || !twitterInput.trim()}
                onClick={handleLinkTwitter}
                className="verity-pill flex h-9 px-5 items-center justify-center bg-inverse text-xs font-semibold text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLinking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Linking...
                  </>
                ) : (
                  "Save Username"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
