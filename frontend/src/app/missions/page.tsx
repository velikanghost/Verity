"use client"

import { useWalletProfile } from "@/hooks/useWalletProfile"
import { Trophy, Send } from "lucide-react"

export default function MissionsPage() {
  const { profile } = useWalletProfile()

  return (
    <div className="w-full max-w-[1240px] mx-auto py-6 font-sans flex flex-col gap-6">
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

          {profile?.twitterUsername && (
            <div className="text-[10px] font-mono text-ash flex items-center gap-1.5 bg-[#FAF9F6] dark:bg-zinc-900/40 border border-stone-200/20 dark:border-zinc-850/10 px-3 py-1.5 rounded-xl">
              <Send className="h-3 w-3 text-indigo-500" />
              <span>X: @{profile.twitterUsername}</span>
            </div>
          )}
        </div>
      </section>

      {/* Waiting State */}
      <div className="verity-card border border-dashed border-border dark:border-zinc-800 rounded-2xl bg-white-surface/40 dark:bg-zinc-900/10 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        {/* Decorative glassmorphic orb in the background */}
        <div className="absolute -left-16 -bottom-16 w-36 h-36 rounded-full bg-sky-blue/10 blur-2xl pointer-events-none" />
        <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-ember-orange/10 blur-2xl pointer-events-none" />

        {/* Animated icon or blob */}
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
    </div>
  )
}
