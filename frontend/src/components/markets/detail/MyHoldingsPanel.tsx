"use client"

import {
  MarketPost,
  MarketPosition,
  VoteSide,
  getMarketPrice,
} from "@/lib/verity"

interface MyHoldingsPanelProps {
  positions: MarketPosition[]
  activeMarket: MarketPost
  viewerVote: VoteSide | null
  onQuickSell: (side: VoteSide) => void
}

export default function MyHoldingsPanel({
  positions,
  activeMarket,
  viewerVote,
  onQuickSell,
}: MyHoldingsPanelProps) {
  if (!viewerVote && positions.length === 0) return null

  return (
    <div className="verity-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-dashed border-stone-surface pb-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
          My Holdings
        </span>
        {viewerVote && (
          <span className="font-mono text-[10px] text-ash">
            Signal:{" "}
            <span
              className={
                viewerVote === "YES"
                  ? "font-semibold text-meadow-green"
                  : "font-semibold text-ember-orange"
              }
            >
              {viewerVote === "YES" ? "Upvote" : "Downvote"}
            </span>
          </span>
        )}
      </div>

      {positions.length === 0 ? (
        <p className="text-xs text-ash">No cash positions in this market.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {positions.map((pos) => {
            const isResolved = activeMarket.status === "resolved"
            const isWinner =
              isResolved && activeMarket.resolvedOutcome === pos.side
            const currentPrice = isResolved
              ? isWinner
                ? 1.0
                : 0.0
              : getMarketPrice(activeMarket, pos.side)
            const currentValue = pos.shares * currentPrice
            const isProfit = currentValue >= pos.invested_usdc
            const pnl = currentValue - pos.invested_usdc
            const pnlPercent =
              pos.invested_usdc > 0 ? (pnl / pos.invested_usdc) * 100 : 0

            return (
              <div
                key={pos.id}
                className="rounded-[12px] bg-parchment-card p-3 shadow-subtle"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  {isResolved ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold ${
                        isWinner
                          ? "bg-meadow-green/10 text-meadow-green shadow-subtle"
                          : "bg-stone-surface text-ash"
                      }`}
                    >
                      {isWinner ? "WINNING" : "LOST"}{" "}
                      {pos.side === "YES" ? "YES" : "NO"} Shares
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono font-semibold shadow-subtle ${
                        pos.side === "YES"
                          ? "bg-meadow-green/10 text-meadow-green"
                          : "bg-ember-orange/10 text-ember-orange"
                      }`}
                    >
                      {pos.side === "YES" ? "YES" : "NO"} Shares
                    </span>
                  )}

                  {!isResolved && (
                    <button
                      className="font-mono text-[10px] font-semibold text-ember-orange underline underline-offset-2 hover:text-charcoal-primary"
                      onClick={() => onQuickSell(pos.side)}
                      type="button"
                    >
                      Quick Sell
                    </button>
                  )}
                </div>

                <div className="mt-1.5 grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="block text-[9px] uppercase text-ash">
                      Shares
                    </span>
                    <span className="font-semibold text-charcoal-primary">
                      {pos.shares.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ash">
                      Avg Price
                    </span>
                    <span className="font-semibold text-charcoal-primary">
                      {pos.avg_price.toFixed(2)} USDC
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase text-ash">
                      Value
                    </span>
                    <span
                      className={
                        isProfit
                          ? "font-semibold text-meadow-green"
                          : "font-semibold text-ember-orange"
                      }
                    >
                      ${currentValue.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-stone-surface pt-2 font-mono text-[10px]">
                  <span className="text-ash">Return:</span>
                  <span
                    className={
                      isProfit
                        ? "font-semibold text-meadow-green"
                        : "font-semibold text-ember-orange"
                    }
                  >
                    {isProfit ? "+" : ""}
                    {pnl.toFixed(2)} USDC ({isProfit ? "+" : ""}
                    {pnlPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
