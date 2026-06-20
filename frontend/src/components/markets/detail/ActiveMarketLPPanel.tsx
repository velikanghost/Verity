"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { MarketPost } from "@/lib/verity"

interface ActiveMarketLPPanelProps {
  market: MarketPost
  poolState: any
  lpPositions: any[]
  profileId: string | undefined
  onAddLP: (amount: number) => Promise<void>
  onRemoveLP: (shares: number) => Promise<void>
  actionLoading: string | null
}

export default function ActiveMarketLPPanel({
  lpPositions,
  onAddLP,
  onRemoveLP,
  actionLoading,
  poolState,
  profileId,
}: ActiveMarketLPPanelProps) {
  const [addAmount, setAddAmount] = useState("10")
  const [removeShares, setRemoveShares] = useState("10")
  const [timeLeftStr, setTimeLeftStr] = useState("")

  const myPosition = lpPositions?.[0]
  const myShares = myPosition?.lpShares ?? 0
  const myDeposited = myPosition?.depositedUsdc ?? 0
  const canRemove = myPosition?.canRemoveLiquidity ?? true

  useEffect(() => {
    if (canRemove || !myPosition?.depositedAt) {
      setTimeLeftStr("")
      return
    }

    const updateTimer = () => {
      const depositTime = new Date(myPosition.depositedAt).getTime()
      const unlockTime = depositTime + 24 * 60 * 60 * 1000
      const now = Date.now()
      const diff = unlockTime - now

      if (diff <= 0) {
        setTimeLeftStr("")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      let str = ""
      if (hours > 0) str += `${hours}h `
      if (minutes > 0 || hours > 0) str += `${minutes}m `
      str += `${seconds}s`

      setTimeLeftStr(str)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [canRemove, myPosition?.depositedAt])

  const totalPoolShares = poolState?.pool?.totalLPShares ?? 0
  const currentPoolBalance = poolState?.pool?.currentPoolBalance ?? 0

  return (
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-1 text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
        Liquidity Provider Management
      </h2>
      <p className="mb-4 text-sm tracking-[-0.18px] text-ash">
        Provide USDC liquidity to earn a share of trading fees.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-[12px] bg-parchment-card p-3 shadow-subtle">
          <span className="font-mono text-[10px] font-semibold uppercase text-ash">
            My LP Shares
          </span>
          <p className="mt-1 font-mono text-lg font-semibold text-charcoal-primary">
            {Number(myShares).toFixed(4)}
          </p>
        </div>
        <div className="rounded-[12px] bg-parchment-card p-3 shadow-subtle">
          <span className="font-mono text-[10px] font-semibold uppercase text-ash">
            My Value
          </span>
          <p className="mt-1 font-mono text-lg font-semibold text-charcoal-primary">
            {Number(myDeposited).toFixed(2)} USDC
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 border-b border-dashed border-stone-surface pb-4 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-ash">Total pool liquidity</span>
          <span className="font-semibold text-charcoal-primary">
            {currentPoolBalance} USDC
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ash">Total LP shares</span>
          <span className="font-semibold text-charcoal-primary">
            {Number(totalPoolShares).toFixed(4)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[12px] bg-parchment-card p-4 shadow-subtle">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-primary">
            Add Liquidity
          </h3>
          <div className="flex gap-2">
            <Input
              className="h-10 w-20 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-subtle border-0 focus-visible:ring-2 focus-visible:ring-stone-surface focus-visible:ring-offset-0 focus-visible:border-transparent"
              min="1"
              onChange={(e) => setAddAmount(e.target.value)}
              step="1"
              type="number"
              value={addAmount}
            />
            <button
              className="verity-pill flex h-10 flex-1 items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                Boolean(actionLoading) || !profileId || Number(addAmount) <= 0
              }
              onClick={() => onAddLP(Number(addAmount))}
              type="button"
            >
              {actionLoading === "add_lp" ? "Adding..." : "Add LP"}
            </button>
          </div>
        </div>

        <div className="rounded-[12px] bg-parchment-card p-4 shadow-subtle">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-primary">
            Remove Liquidity
          </h3>
          <div className="flex gap-2">
            <Input
              className="h-10 w-20 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-subtle border-0 focus-visible:ring-2 focus-visible:ring-stone-surface focus-visible:ring-offset-0 focus-visible:border-transparent"
              max={myShares}
              min="0.0001"
              onChange={(e) => setRemoveShares(e.target.value)}
              step="0.01"
              type="number"
              value={removeShares}
            />
            <button
              className="verity-pill flex h-10 flex-1 items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                Boolean(actionLoading) ||
                !profileId ||
                Number(removeShares) <= 0 ||
                Number(removeShares) > myShares ||
                !canRemove
              }
              onClick={() => onRemoveLP(Number(removeShares))}
              type="button"
            >
              {actionLoading === "remove_lp" ? "Removing..." : "Remove"}
            </button>
          </div>
          {!canRemove && (
            <p className="mt-2 text-[10px] leading-relaxed text-ember-orange">
              * Liquidity is locked for 24 hours after adding to prevent
              front-running.
              {timeLeftStr && ` (Unlocks in ${timeLeftStr})`}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
