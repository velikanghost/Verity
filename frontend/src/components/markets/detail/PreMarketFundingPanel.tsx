"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Info } from "lucide-react"
import { MarketPost } from "@/lib/verity"

interface PreMarketFundingPanelProps {
  market: MarketPost
  poolState: any
  profileId: string | undefined
  authorId: string | undefined
  onFundPreMarket: (amount: number) => Promise<void>
  onAddLP: (amount: number) => Promise<void>
  actionLoading: string | null
  activeOptionName?: string | null
}

export default function PreMarketFundingPanel({
  market,
  poolState,
  profileId,
  authorId,
  onFundPreMarket,
  onAddLP,
  actionLoading,
  activeOptionName,
}: PreMarketFundingPanelProps) {
  const currentPoolBalance = poolState?.pool?.currentPoolBalance ?? 0
  const minPoolBalance = poolState?.pool?.minimumPoolBalance ?? 20
  const creatorLiquidity = poolState?.pool?.creatorLiquidity ?? 5
  const progress = Math.min(100, (currentPoolBalance / minPoolBalance) * 100)

  const [depositAmount, setDepositAmount] = useState("10")
  const showCreatorEscrow = false
  const isCurrentUserCreator = Boolean(
    profileId && authorId && profileId === authorId,
  )

  return (
    <section className="verity-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
            {activeOptionName
              ? `Funding Pool: ${activeOptionName}`
              : "Pool Funding"}
          </h2>
          <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
            {activeOptionName
              ? `Fund the launch pool for the option group: ${activeOptionName}. Contributions fund this group's shared liquidity pool, which must reach ${minPoolBalance} USDC to activate trading.`
              : `Fund this market's launch pool. Contributions convert to LP shares once the pool hits ${minPoolBalance} USDC.`}
          </p>
        </div>
        <span className="rounded-full bg-meadow-green/10 px-3 py-1 font-mono text-xs font-semibold text-charcoal-primary shadow-subtle">
          {currentPoolBalance} / {minPoolBalance} USDC
        </span>
      </div>

      {activeOptionName && (
        <div className="mb-4 rounded-[12px] bg-sky-blue/5 border border-sky-blue/10 p-3 text-[11px] leading-[1.4] text-sky-blue flex gap-2 items-start shadow-subtle">
          <Info className="h-4 w-4 shrink-0 text-sky-blue mt-0.5" />
          <div>
            <span>
              You are currently funding the <strong>{activeOptionName}</strong>{" "}
              pool. This pool covers all outcomes within this option group and must reach{" "}
              <strong>{minPoolBalance} USDC</strong> to activate trading.
            </span>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-[12px] bg-parchment-card p-4 shadow-subtle">
        <div className="mb-1 flex justify-between font-mono text-xs text-ash">
          <span>
            {activeOptionName ? `${activeOptionName} Pool` : "Pool Funding"}
          </span>
          <span className="font-semibold text-charcoal-primary">
            {currentPoolBalance} USDC
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-white-surface shadow-subtle">
          <div
            className="h-full bg-meadow-green transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {showCreatorEscrow ? (
          <div className="rounded-[12px] bg-meadow-green/10 p-4 text-center shadow-subtle">
            <h3 className="text-sm font-semibold text-charcoal-primary">
              Creator Action Required
            </h3>
            <p className="mb-3 mt-1 text-xs text-ash">
              The creator must fund the first {creatorLiquidity} USDC to initialize the pool and
              activate funding.
            </p>
            {isCurrentUserCreator ? (
              <button
                className="verity-pill flex h-11 w-full items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={Boolean(actionLoading) || !profileId}
                onClick={() => onFundPreMarket(creatorLiquidity)}
                type="button"
              >
                {actionLoading === "fund_pre_market"
                  ? "Funding..."
                  : `Fund ${creatorLiquidity} USDC`}
              </button>
            ) : null}
          </div>
        ) : currentPoolBalance >= minPoolBalance ? (
          <div className="flex flex-col items-center justify-center rounded-[12px] bg-parchment-card py-6 text-center shadow-subtle">
            <svg
              className="mb-3 h-8 w-8 animate-spin text-meadow-green"
              fill="none"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="font-mono text-sm font-semibold text-charcoal-primary">
              All conditions met
            </span>
            <span className="mt-1 text-xs text-ash">
              Deploying market on-chain...
            </span>
          </div>
        ) : (
          <div className="rounded-[12px] bg-parchment-card p-4 shadow-subtle">
            <h3 className="mb-3 text-sm font-semibold text-charcoal-primary">
              {activeOptionName
                ? `Fund the ${activeOptionName} Pool`
                : "Fund the Launch Pool"}
            </h3>
            <div className="flex gap-2">
              <Input
                className="h-11 w-24 rounded-[10px] bg-white-surface px-3 font-mono text-sm text-charcoal-primary shadow-subtle border-0 focus-visible:ring-2 focus-visible:ring-stone-surface focus-visible:ring-offset-0 focus-visible:border-transparent"
                min="1"
                onChange={(e) => setDepositAmount(e.target.value)}
                step="1"
                type="number"
                value={depositAmount}
              />
              <button
                className="verity-pill flex h-11 flex-1 items-center justify-center bg-inverse font-mono text-xs font-semibold uppercase tracking-[0.12em] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={
                  Boolean(actionLoading) ||
                  !profileId ||
                  Number(depositAmount) <= 0
                }
                onClick={() => onAddLP(Number(depositAmount))}
                type="button"
              >
                {actionLoading === "add_lp" ? "Funding..." : "Fund Pool"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
