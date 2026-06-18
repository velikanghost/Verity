"use client"

import {
  MarketPost,
  VoteSide,
  MarketPosition,
  getMarketPrice,
} from "@/lib/verity"

interface PositionPanelProps {
  freeVote: VoteSide | null
  market: MarketPost
  onSell: (side: VoteSide) => void
  positions: MarketPosition[]
}

export default function PositionPanel({
  freeVote,
  market,
  onSell,
  positions,
}: PositionPanelProps) {
  const positionRows = positions.map((position) => {
    const currentPrice = getMarketPrice(market, position.side)
    return {
      ...position,
      currentPrice,
      currentValue: position.shares * currentPrice,
      payoutPreview: position.shares,
    }
  })

  return (
    <div className="grid gap-3">
      {positionRows.length > 0 && (
        <section className="verity-card p-5">
          <h2 className="font-semibold tracking-[-0.18px] text-charcoal-primary">
            My Payout Preview
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed tracking-[-0.18px] text-graphite">
            Preview of potential payouts if the market resolves to your chosen
            outcome side. Payouts are fully secured on-chain.
          </p>

          <div className="mt-5 grid gap-3">
            {positionRows.map((position) => (
              <div
                className="flex items-center justify-between gap-4 font-mono text-sm"
                key={position.id}
              >
                <span className="text-ash">
                  {position.side === "YES"
                    ? market.yes_condition || market.yesCondition || "Yes"
                    : market.no_condition || market.noCondition || "No"}
                </span>
                <span
                  className={
                    position.side === "YES"
                      ? "text-meadow-green"
                      : "text-ember-orange"
                  }
                >
                  ${position.payoutPreview.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
