'use client'

import { useUserPortfolio } from '@/hooks/useUserPortfolio'
import Link from 'next/link'
import { ArrowUpRight, TrendingUp } from 'lucide-react'

export default function PortfolioPositions() {
  const { positions, isLoading, stats } = useUserPortfolio()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-24 rounded-[12px] bg-surface-muted border border-border" />
        <div className="h-48 rounded-[12px] bg-surface-muted border border-border" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[12px] border border-border bg-surface p-5 shadow-sm">
          <span className="font-mono text-[10px] uppercase text-muted font-black">
            Active Positions
          </span>
          <p className="mt-1 font-mono text-2xl font-black text-foreground">
            {stats.totalPositions}
          </p>
        </div>
        <div className="rounded-[12px] border border-border bg-surface p-5 shadow-sm">
          <span className="font-mono text-[10px] uppercase text-muted font-black">
            USDC Invested
          </span>
          <p className="mt-1 font-mono text-2xl font-black text-brand-secondary">
            {stats.totalInvested.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-[12px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
          <TrendingUp className="h-4 w-4 text-accent" />
          <h2 className="font-black text-sm uppercase tracking-wider text-foreground">
            Outcome Token Holdings
          </h2>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted">
              You do not hold any YES/NO outcome tokens yet.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex h-9 items-center justify-center rounded-[8px] border border-border px-4 font-mono text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-surface-muted"
            >
              Explore Markets
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {positions.map((pos) => {
              const yes = pos.side === 'YES'
              return (
                <div
                  key={pos.id}
                  className="group rounded-[8px] border border-border bg-surface-muted p-4 transition-all hover:bg-surface-solid flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${yes ? 'bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20' : 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20'}`}
                    >
                      {pos.side}
                    </span>
                    <h3 className="mt-2 text-sm font-black text-foreground leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      Market ID: {pos.market_id.slice(0, 12)}...
                    </h3>
                  </div>

                  <div className="flex items-center gap-6 font-mono text-xs text-right">
                    <div>
                      <span className="text-muted text-[9px] block uppercase font-black">
                        Shares
                      </span>
                      <span className="font-bold text-foreground">
                        {pos.shares.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted text-[9px] block uppercase font-black">
                        Avg Price
                      </span>
                      <span className="font-bold text-foreground">
                        {pos.avg_price.toFixed(2)} USDC
                      </span>
                    </div>
                    <div>
                      <span className="text-muted text-[9px] block uppercase font-black">
                        Invested
                      </span>
                      <span className="font-bold text-brand-secondary">
                        {pos.invested_usdc.toFixed(2)} USDC
                      </span>
                    </div>
                    <Link
                      href={`/markets/${pos.market_id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-surface text-muted hover:text-foreground transition-colors"
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
