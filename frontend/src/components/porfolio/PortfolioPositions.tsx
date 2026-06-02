"use client"

import { useUserPortfolio } from "@/hooks/useUserPortfolio"
import Link from "next/link"
import { ArrowUpRight, TrendingUp } from "lucide-react"

export default function PortfolioPositions() {
  const { positions, isLoading, stats } = useUserPortfolio()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-24 rounded-[12px] bg-parchment-card shadow-[(--shadow-subtle)]" />
        <div className="h-48 rounded-[12px] bg-parchment-card shadow-[(--shadow-subtle)]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="verity-card p-5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ash">
            Active Positions
          </span>
          <p className="mt-1 font-mono text-2xl font-semibold text-midnight">
            {stats.totalPositions}
          </p>
        </div>
        <div className="verity-card p-5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ash">
            USDC Invested
          </span>
          <p className="mt-1 font-mono text-2xl font-semibold text-meadow-green">
            {stats.totalInvested.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="verity-card p-6">
        <div className="mb-4 flex items-center gap-2 border-b border-stone-surface pb-3">
          <TrendingUp className="h-4 w-4 text-ember-orange" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
            Outcome Token Holdings
          </h2>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm tracking-[-0.18px] text-graphite">
              You do not hold any market outcome tokens yet.
            </p>
            <Link
              href="/"
              className="verity-pill mt-3 inline-flex h-9 items-center justify-center bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90"
            >
              Explore Markets
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {positions.map((pos) => {
              const yes = pos.side === "YES"
              return (
                <div
                  key={pos.id}
                  className="group flex flex-col gap-4 rounded-[12px] bg-parchment-card p-4 shadow-[(--shadow-subtle)] transition-colors hover:bg-stone-surface sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className={`verity-pill inline-flex items-center px-2.5 py-0.5 font-mono text-[10px] font-semibold ${yes ? "bg-meadow-green/10 text-meadow-green" : "bg-ember-orange/10 text-ember-orange"}`}
                    >
                      {pos.side}
                    </span>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug tracking-[-0.18px] text-charcoal-primary transition-colors group-hover:text-ember-orange">
                      {pos.market_question ||
                        `Market ID: ${pos.market_id.slice(0, 12)}...`}
                    </h3>
                  </div>

                  <div className="flex items-center gap-6 font-mono text-xs text-right">
                    <div>
                      <span className="block text-[9px] font-semibold uppercase text-ash">
                        Shares
                      </span>
                      <span className="font-semibold text-charcoal-primary">
                        {pos.shares.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-semibold uppercase text-ash">
                        Avg Price
                      </span>
                      <span className="font-semibold text-charcoal-primary">
                        {pos.avg_price.toFixed(2)} USDC
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-semibold uppercase text-ash">
                        Invested
                      </span>
                      <span className="font-semibold text-meadow-green">
                        {pos.invested_usdc.toFixed(2)} USDC
                      </span>
                    </div>
                    <Link
                      href={`/markets/${pos.market_id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white-surface text-ash shadow-[(--shadow-subtle)] transition-colors hover:text-charcoal-primary"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
