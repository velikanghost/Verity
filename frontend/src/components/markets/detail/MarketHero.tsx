"use client"

import { MarketPost, VoteSide } from "@/lib/verity"

interface MarketHeroProps {
  category: string
  creator: string
  market: MarketPost
  question: string
  time: string
  yesPercent: number
  noPercent: number
  onDevQualify?: () => Promise<void>
  devQualifyLoading?: boolean
}

export default function MarketHero({
  category,
  creator,
  market,
  question,
  time,
  yesPercent,
  noPercent,
  onDevQualify,
  devQualifyLoading = false,
}: MarketHeroProps) {
  const isDev = process.env.NEXT_PUBLIC_NODE_ENV !== "production"

  return (
    <section className="verity-card relative overflow-hidden p-5 mt-4">
      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-sunburst-yellow/30" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="relative min-w-0">
          <h1 className="text-[23px] font-semibold leading-[1.12] tracking-[-0.44px] text-midnight sm:text-[32px]">
            {question}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-ash">
            <span className="rounded-[6px] bg-parchment-card px-2.5 py-1 text-graphite shadow-subtle">
              {category?.toLowerCase() === "pvp" ? "PvP" : category}
            </span>
            <span>by {creator}</span>
            <span>{"\u00B7"}</span>
            <span>{time}</span>
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-stone-surface pt-3 font-mono text-xs text-ash items-center">
        <span>
          Sentiment:{" "}
          <strong className="text-meadow-green">
            Yes {yesPercent.toFixed(1)}%
          </strong>
          {" / "}
          <strong className="text-ember-orange">
            No {noPercent.toFixed(1)}%
          </strong>
        </span>
      </div>
    </section>
  )
}
