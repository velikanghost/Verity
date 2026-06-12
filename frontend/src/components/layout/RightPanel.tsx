"use client"

import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Search, TrendingUp, Trophy } from "lucide-react"
import { useFeed } from "@/hooks/useFeed"
import { useRightPanelSlot } from "@/hooks/useRightPanelSlot"
import { displayHandle, displayName } from "@/lib/verity"

export default function RightPanel() {
  const { items, loading } = useFeed(undefined, true)
  const marketItems = items.filter((item) => item.market)
  const trending = marketItems.slice(0, 3)
  const predictors = Array.from(
    new Map(items.map((item) => [item.author.id, item.author])).values(),
  ).slice(0, 3)
  const slotContent = useRightPanelSlot()

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto no-scrollbar pb-8">
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <Search className="h-5 w-5 text-ash transition-colors group-focus-within:text-charcoal-primary" />
        </div>
        <Input
          className="verity-card w-full h-11 rounded-[32px] pl-12 pr-4 text-[15px] tracking-[-0.2px] text-charcoal-primary border-0 focus-visible:ring-2 focus-visible:ring-stone-surface focus-visible:ring-offset-0 focus-visible:border-transparent"
          placeholder="Search markets, users..."
          type="text"
        />
      </div>

      {/* Dynamic slot content injected by child pages (e.g. MarketDetail) */}
      {slotContent}

      <div className="verity-card flex flex-col overflow-hidden">
        <div className="border-b border-dashed border-stone-surface p-4">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
            <TrendingUp className="h-4 w-4 text-meadow-green" />
            Trending Markets
          </h2>
        </div>

        <div className="flex flex-col">
          {loading ? (
            <div className="flex flex-col animate-pulse">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 border-b border-dashed border-stone-surface p-4"
                >
                  <div className="h-3 w-20 rounded bg-stone-surface" />
                  <div className="h-4 w-5/6 rounded bg-stone-surface animate-pulse" />
                  <div className="flex justify-between items-center mt-1">
                    <div className="h-3.5 w-12 rounded bg-stone-surface" />
                    <div className="h-3.5 w-16 rounded bg-stone-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : trending.length > 0 ? (
            trending.map((item) => {
              const market = item.market
              const yes = market
                ? calculateYesPercent(
                    Number(market.usdc_yes_amount),
                    Number(market.usdc_no_amount),
                  )
                : 50
              const volume = market
                ? Number(market.usdc_yes_amount) + Number(market.usdc_no_amount)
                : 0

              return (
                <div
                  className="flex cursor-pointer flex-col gap-2 border-b border-dashed border-stone-surface p-4 transition-colors hover:bg-parchment-card"
                  key={item.id}
                >
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ash">
                    Trending in {market?.category?.toLowerCase() === "pvp" ? "PvP" : market?.category || "Markets"}
                  </span>
                  <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.18px] text-charcoal-primary">
                    {market?.question}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-meadow-green">
                      {yes.toFixed(0)}% YES
                    </span>
                    <span className="font-mono text-xs text-ash">
                      {volume.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-4 text-sm text-ash">No live markets yet.</div>
          )}
        </div>

        <button className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-[0.12em] text-charcoal-primary transition-colors hover:bg-parchment-card">
          Show more
        </button>
      </div>

      {!slotContent && (
        <div className="verity-card flex flex-col overflow-hidden">
          <div className="border-b border-dashed border-stone-surface p-4">
            <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
              <Trophy className="h-4 w-4 text-sunburst-yellow" />
              Top Predictors
            </h2>
          </div>

          <div className="flex flex-col">
            {loading ? (
              <div className="flex flex-col animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-stone-surface shrink-0" />
                      <div className="flex flex-col gap-1.5">
                        <div className="h-3.5 w-24 rounded bg-stone-surface" />
                        <div className="h-3 w-16 rounded bg-stone-surface" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="h-3 w-8 rounded bg-stone-surface" />
                      <div className="h-3 w-12 rounded bg-stone-surface" />
                    </div>
                  </div>
                ))}
              </div>
            ) : predictors.length > 0 ? (
              predictors.map((user) => (
                <Link
                  className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-parchment-card"
                  href={`/profile/${encodeURIComponent(user.id)}`}
                  key={user.id}
                >
                  <div className="flex items-center gap-3">
                    <div className="verity-blob h-10 w-10 bg-sky-blue">
                      <span className="verity-blob-smile" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold leading-none tracking-[-0.18px] text-charcoal-primary hover:underline">
                        {displayName(user)}
                      </span>
                      <span className="mt-1 font-mono text-xs text-ash">
                        {displayHandle(user)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-meadow-green">
                      Live
                    </span>
                    <span className="font-mono text-[10px] uppercase text-ash">
                      Creator
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-4 text-sm text-ash">No predictors yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 font-mono text-[11px] text-ash">
        <a href="#" className="hover:underline">
          Terms of Service
        </a>
        <a href="#" className="hover:underline">
          Privacy Policy
        </a>
        <a href="#" className="hover:underline">
          Cookie Policy
        </a>
        <a href="#" className="hover:underline">
          Accessibility
        </a>
        <Link href="/how-it-works" className="hover:underline">
          How it works
        </Link>
        <span>{"\u00A9"} 2026 Verity</span>
      </div>
    </div>
  )
}

function calculateYesPercent(yes: number, no: number) {
  const total = yes + no
  if (total === 0) return 50
  return (yes / total) * 100
}
