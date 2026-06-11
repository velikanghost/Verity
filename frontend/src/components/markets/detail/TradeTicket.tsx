"use client"

import { MarketTradeAction, VoteSide } from "@/lib/verity"

interface OutcomeButtonProps {
  active: boolean
  label: string
  onClick: (side: VoteSide) => void
  price: number
  side: VoteSide
}

function OutcomeButton({
  active,
  label,
  onClick,
  price,
  side,
}: OutcomeButtonProps) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-[12px] px-3 py-3 text-center shadow-subtle transition-colors border ${
        active
          ? side === "YES"
            ? "bg-meadow-green/12 border-meadow-green/35 text-meadow-green"
            : side === "NO"
              ? "bg-ember-orange/10 border-ember-orange/30 text-ember-orange"
              : "bg-sky-blue/12 border-sky-blue/30 text-sky-blue"
          : "bg-parchment-card hover:bg-stone-surface border-transparent text-charcoal-primary"
      }`}
      onClick={() => onClick(side)}
      type="button"
    >
      <span className="block text-sm font-semibold truncate max-w-full">
        {label}
      </span>
      <span className="font-mono text-[11px] text-ash block mt-0.5">
        {price.toFixed(1)}¢ implied
      </span>
    </button>
  )
}

interface TradeTicketProps {
  action: MarketTradeAction
  amount: string
  balanceLabel: string
  disabled: boolean
  estimatedShares: number
  fee: number
  isConnected: boolean
  netProceeds: number
  noPrice: number
  onActionChange: (action: MarketTradeAction) => void
  onAmountChange: (value: string) => void
  onSideChange: (side: VoteSide) => void
  onTrade: () => void
  price: number
  selectedSide: VoteSide
  sellProceeds: number
  total: number
  yesPrice: number
  actionPending?: boolean
  maxSellShares: number
  yesCondition?: string
  noCondition?: string
  outcomeCount?: number
  outcomes?: string[]
  outcomePrices?: number[]
  isBalanceInsufficient?: boolean
}

export default function TradeTicket({
  action,
  amount,
  balanceLabel,
  disabled,
  estimatedShares,
  fee,
  isConnected,
  netProceeds,
  noPrice,
  onActionChange,
  onAmountChange,
  onSideChange,
  onTrade,
  price,
  selectedSide,
  sellProceeds,
  total,
  yesPrice,
  actionPending = false,
  maxSellShares,
  yesCondition = "Yes",
  noCondition = "No",
  outcomeCount = 2,
  outcomes = [],
  outcomePrices = [],
  isBalanceInsufficient = false,
}: TradeTicketProps) {
  const quickBuyAmounts = [1, 5, 10, 100]
  const sellPercentages = [25, 50, 75, 100]
  const amountNumber = Number(amount)
  const previewValue =
    Number.isFinite(amountNumber) && amountNumber > 0 ? amountNumber : 0

  function addBuyAmount(value: number) {
    const nextAmount = Number.isFinite(amountNumber)
      ? amountNumber + value
      : value
    onAmountChange(String(nextAmount))
  }

  function setSellPercentage(percent: number) {
    const shares = (maxSellShares * percent) / 100
    onAmountChange(shares > 0 ? shares.toFixed(4) : "0")
  }

  const isMulti = outcomeCount > 2
  const sideLabel = isMulti
    ? selectedSide
    : selectedSide === "YES"
      ? yesCondition
      : noCondition

  return (
    <section className="verity-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-stone-surface px-4 py-3">
        <div className="flex gap-4">
          {(["BUY", "SELL"] as const).map((nextAction) => (
            <button
              aria-pressed={action === nextAction}
              className={`relative h-8 text-sm font-semibold tracking-[-0.18px] transition-colors ${
                action === nextAction
                  ? "text-charcoal-primary"
                  : "text-ash hover:text-charcoal-primary"
              }`}
              key={nextAction}
              onClick={() => onActionChange(nextAction)}
              type="button"
            >
              {nextAction === "BUY" ? "Buy" : "Sell"}
              {action === nextAction && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-charcoal-primary" />
              )}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] font-semibold text-charcoal-primary">
          Market
        </span>
      </div>

      <div className="p-4">
        {isMulti ? (
          <div
            className={`mb-6 grid gap-3 ${outcomes.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
          >
            {outcomes.map((outcomeName, idx) => {
              const oPrice = outcomePrices[idx] ?? 1 / outcomeCount
              const priceCents = oPrice * 100
              const active = selectedSide === outcomeName

              return (
                <OutcomeButton
                  key={outcomeName}
                  active={active}
                  label={outcomeName}
                  price={priceCents}
                  side={outcomeName}
                  onClick={onSideChange}
                />
              )
            })}
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <OutcomeButton
              active={selectedSide === "YES"}
              label={yesCondition}
              price={yesPrice}
              side="YES"
              onClick={onSideChange}
            />
            <OutcomeButton
              active={selectedSide === "NO"}
              label={noCondition}
              price={noPrice}
              side="NO"
              onClick={onSideChange}
            />
          </div>
        )}

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <label
              className="block text-[15px] font-semibold tracking-[-0.2px] text-charcoal-primary"
              htmlFor="market-trade-amount"
            >
              {action === "BUY" ? "Amount" : "Shares"}
            </label>
            <p
              className={`mt-0.5 font-mono text-[11px] ${isBalanceInsufficient ? "text-red-500 font-bold" : "text-ash"}`}
            >
              {action === "BUY"
                ? `${balanceLabel} USDC balance`
                : `${maxSellShares.toFixed(4)} ${sideLabel} available`}
            </p>
          </div>
          <input
            aria-label={action === "BUY" ? "USDC amount" : "Shares to sell"}
            className="h-14 w-32 bg-transparent text-right font-mono text-[34px] font-semibold leading-none tracking-[-1px] text-midnight outline-none placeholder:text-ash"
            id="market-trade-amount"
            min="0"
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0"
            step="0.01"
            type="number"
            value={amount}
          />
        </div>
        {action === "BUY" && isBalanceInsufficient && (
          <p className="text-[10px] text-red-500 font-semibold text-right -mt-2.5 mb-3">
            Insufficient USDC balance.
          </p>
        )}

        {action === "BUY" ? (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            {quickBuyAmounts.map((value) => (
              <button
                className="verity-pill h-8 bg-parchment-card px-3 font-mono text-xs font-semibold text-graphite shadow-subtle transition-colors hover:bg-stone-surface"
                key={value}
                onClick={() => addBuyAmount(value)}
                type="button"
              >
                +${value}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            {sellPercentages.map((percent) => (
              <button
                className="verity-pill h-8 bg-parchment-card px-3 font-mono text-xs font-semibold text-graphite shadow-subtle transition-colors hover:bg-stone-surface disabled:cursor-not-allowed disabled:opacity-45"
                disabled={maxSellShares <= 0}
                key={percent}
                onClick={() => setSellPercentage(percent)}
                type="button"
              >
                {percent === 100 ? "Max" : `${percent}%`}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-1 rounded-[12px] bg-parchment-card p-3 font-mono text-[11px] text-ash shadow-subtle">
          <div className="flex justify-between">
            <span>Price</span>
            <span>{(price * 100).toFixed(1)}¢</span>
          </div>
          <div className="flex justify-between">
            <span>
              {action === "BUY" ? "Estimated shares" : "Gross proceeds"}
            </span>
            <span>
              {action === "BUY"
                ? estimatedShares.toFixed(4)
                : `${sellProceeds.toFixed(4)} USDC`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Trading fee</span>
            <span>{fee.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-charcoal-primary">
            <span>{action === "BUY" ? "Total" : "Net proceeds"}</span>
            <span>
              {previewValue > 0
                ? action === "BUY"
                  ? total.toFixed(4)
                  : netProceeds.toFixed(4)
                : "0.0000"}{" "}
              USDC
            </span>
          </div>
        </div>

        <button
          className="verity-pill mt-4 flex h-11 w-full items-center justify-center bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={
            disabled ||
            !isConnected ||
            (action === "BUY" && isBalanceInsufficient)
          }
          onClick={onTrade}
          type="button"
        >
          {actionPending
            ? "Processing..."
            : isConnected
              ? action === "BUY" && isBalanceInsufficient
                ? "Insufficient USDC Balance"
                : `${action === "BUY" ? "Buy" : "Sell"} ${sideLabel}`
              : "Connect Wallet"}
        </button>
      </div>
    </section>
  )
}
