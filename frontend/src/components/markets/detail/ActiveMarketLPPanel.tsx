"use client"

import { useState, useEffect } from "react"
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
  const [timeLeft, setTimeLeft] = useState<number>(0)

  const myPosition = lpPositions?.[0]
  const myShares = myPosition?.lpShares ?? 0
  const myDeposited = myPosition?.depositedUsdc ?? 0
  const isCreator = myPosition?.isCreator ?? false

  useEffect(() => {
    if (!myPosition || isCreator) return

    const updateCountdown = () => {
      const depositTime = new Date(myPosition.depositedAt).getTime()
      const lockDuration = 24 * 60 * 60 * 1000 // 24 hours
      const now = Date.now()
      const remaining = depositTime + lockDuration - now
      setTimeLeft(Math.max(0, remaining))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [myPosition, isCreator])

  const canRemove = myShares > 0 && !isCreator && timeLeft === 0

  const totalPoolShares = poolState?.pool?.totalLPShares ?? 0
  const currentPoolBalance = poolState?.pool?.currentPoolBalance ?? 0

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}h ${minutes}m ${seconds}s`
  }

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
            <input
              className="h-10 w-20 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-subtle outline-none focus:ring-2 focus:ring-stone-surface"
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
            <input
              className="h-10 w-20 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-subtle outline-none focus:ring-2 focus:ring-stone-surface"
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
          {myShares > 0 && (
            <>
              {isCreator && (
                <p className="mt-2 text-[10px] leading-relaxed text-ember-orange">
                  * Creator liquidity is locked until the market is resolved.
                </p>
              )}
              {!isCreator && timeLeft > 0 && (
                <p className="mt-2 text-[10px] leading-relaxed text-ember-orange">
                  * Liquidity is locked for 24 hours to prevent front-running.
                  Available in {formatTime(timeLeft)}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
