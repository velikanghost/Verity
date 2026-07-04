"use client"

import { useState } from "react"
import {
  ArrowUpRight,
  Send,
  ArrowDownLeft,
  ExternalLink,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react"
import { useDailyVotes } from "@/hooks/useDailyVotes"
import { useFeed } from "@/hooks/useFeed"
import { useUserPortfolio } from "@/hooks/useUserPortfolio"
import {
  useUserTradesQuery,
  useAccruedLpFeesQuery,
  useClaimLpFeesMutation,
} from "@/store/verity/verityQueries"
import toast from "@/lib/toast"
import Link from "next/link"
import { useAuth } from "@/components/providers/AuthModals"
import SendUsdcModal from "./SendUsdcModal"
import ReceiveUsdcModal from "./ReceiveUsdcModal"

export default function PortfolioDashboard() {
  const { login } = useAuth()
  const {
    positions,
    isLoading: isPortfolioLoading,
    stats,
    usdcBalance,
    profile,
    refetch,
  } = useUserPortfolio()
  const userId = profile?.id || ""
  const { data: trades, isLoading: isTradesLoading } =
    useUserTradesQuery(userId)
  const { data: accruedData } = useAccruedLpFeesQuery(userId)
  const { mutateAsync: claimLpFees, isPending: isClaiming } = useClaimLpFeesMutation()

  const accruedLpFees = accruedData?.accruedFeesUsdc || 0

  const handleClaimLpFees = async () => {
    try {
      const result = await claimLpFees()
      toast.success(`Successfully claimed ${result.amountClaimed.toFixed(4)} USDC in LP fees!`)
      refetch()
    } catch (err: any) {
      toast.error(err?.message || "Failed to claim LP fees.")
    }
  }
  const { dailyVotes, isLoading: isDailyVotesLoading } = useDailyVotes(
    profile?.id,
  )
  const { items: feedItems, loading: isFeedLoading } = useFeed(undefined, true)

  const marketItems = feedItems.filter((item) => item.market)
  const trending = marketItems.slice(0, 3)

  const [activeTab, setActiveTab] = useState<
    "overview" | "tokens" | "activity"
  >("overview")
  const [isSendOpen, setIsSendOpen] = useState(false)
  const [isRecvOpen, setIsRecvOpen] = useState(false)

  const isConnected = !!profile

  if (!isConnected) {
    return (
      <div className="verity-card p-8 mt-6 text-center flex flex-col items-center justify-center border border-border bg-surface-solid">
        <h3 className="text-lg font-semibold text-charcoal-primary">
          Access Your Portfolio
        </h3>
        <p className="mt-2 text-sm text-ash max-w-sm">
          Login or Signup to view your positions, check your P&L, and send or
          receive USDC.
        </p>
        <div className="mt-6 w-full max-w-[240px]">
          <button
            onClick={login}
            className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  const isLoading = isPortfolioLoading || isTradesLoading

  if (isLoading) {
    return (
      <div className="flex flex-col mt-4 gap-4 animate-pulse">
        <div className="h-40 rounded-[12px] bg-stone-surface" />
        <div className="h-64 rounded-[12px] bg-stone-surface" />
      </div>
    )
  }

  const recentTrades = trades ? trades.slice(0, 5) : []
  const recentPositions = positions.slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-3 sm:py-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="verity-card relative overflow-hidden p-4 sm:p-5">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-sunburst-yellow/30" />
            <p className="relative font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ember-orange">
              Portfolio
            </p>
            <h1 className="relative mt-1 text-[30px] font-semibold leading-[1.08] tracking-[-0.7px] text-midnight sm:text-[34px] sm:tracking-[-0.9px]">
              Prediction Portfolio
            </h1>
            <p className="relative mt-2 max-w-[520px] text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
              Manage your stakes, view prediction P&L, perform USDC transfers,
              and track daily signals.
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 verity-card p-6 bg-surface-solid border border-border relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-4 top-7 flex flex-col items-end gap-1.5">
                <div className="text-right mt-1">
                  <span className="block font-mono text-[8px] text-ash uppercase tracking-wider">
                    Daily Signals
                  </span>
                  <span className="font-mono text-xs font-bold text-charcoal-primary">
                    {isDailyVotesLoading
                      ? "..."
                      : `${dailyVotes.votesRemaining}/${dailyVotes.votesLimit}`}
                  </span>
                </div>
              </div>
              <div>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ash">
                  Total Portfolio Value
                </span>
                <h2 className="mt-2 font-mono text-4xl font-semibold tracking-[-0.9px] text-midnight">
                  ${stats.netWorth.toFixed(2)}
                </h2>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-stone-surface pt-4">
                <div>
                  <span className="block font-mono text-[9px] font-semibold text-ash uppercase tracking-wider">
                    USDC Balance
                  </span>
                  <span className="font-mono text-base font-semibold text-charcoal-primary">
                    ${usdcBalance.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="block font-mono text-[9px] font-semibold text-ash uppercase tracking-wider">
                    Active Positions
                  </span>
                  <span className="font-mono text-base font-semibold text-charcoal-primary">
                    ${stats.holdingsValue.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="block font-mono text-[9px] font-semibold text-ash uppercase tracking-wider">
                    Unrealized P&L
                  </span>
                  <span
                    className={`font-mono text-base font-semibold ${stats.unrealizedPnL >= 0 ? "text-meadow-green" : "text-ember-orange"}`}
                  >
                    {stats.unrealizedPnL >= 0 ? "+" : ""}
                    {stats.unrealizedPnL.toFixed(2)} USDC
                  </span>
                </div>
                <div>
                  <span className="block font-mono text-[9px] font-semibold text-ash uppercase tracking-wider">
                    Accrued LP Fees
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-base font-semibold text-charcoal-primary">
                      ${accruedLpFees.toFixed(4)}
                    </span>
                    {accruedLpFees > 0 && (
                      <button
                        onClick={handleClaimLpFees}
                        disabled={isClaiming}
                        className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#FF4D00] text-white font-bold hover:bg-[#E04400] transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isClaiming ? "..." : "Claim"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Grid (1/3 width on desktop) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsSendOpen(true)}
                className="verity-card p-4 flex flex-col items-center justify-center gap-2 bg-stone-surface hover:bg-stone-surface/80 border border-border rounded-[12px] transition-all cursor-pointer group text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-orange/10 text-ember-orange transition-transform group-hover:-translate-y-1">
                  <Send className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-charcoal-primary tracking-[-0.1px]">
                  Send
                </span>
              </button>

              <button
                onClick={() => setIsRecvOpen(true)}
                className="verity-card p-4 flex flex-col items-center justify-center gap-2 bg-stone-surface hover:bg-stone-surface/80 border border-border rounded-[12px] transition-all cursor-pointer group text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-blue/10 text-sky-blue transition-transform group-hover:translate-y-1">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-charcoal-primary tracking-[-0.1px]">
                  Receive
                </span>
              </button>

              <Link
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="verity-card p-4 flex flex-col items-center justify-center gap-2 bg-stone-surface hover:bg-stone-surface/80 border border-border rounded-[12px] transition-all cursor-pointer group text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sunburst-yellow/10 text-sunburst-yellow transition-transform group-hover:scale-110">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-charcoal-primary tracking-[-0.1px]">
                  Faucet
                </span>
              </Link>

              <Link
                href={`https://testnet.arcscan.app/address/${profile?.walletAddress || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="verity-card p-4 flex flex-col items-center justify-center gap-2 bg-stone-surface hover:bg-stone-surface/80 border border-border rounded-[12px] transition-all cursor-pointer group text-center"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-graphite/10 text-graphite transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-charcoal-primary tracking-[-0.1px] truncate w-full px-1">
                  Explorer
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Section (spanning 1 column on desktop, holds Trending Markets) */}
        <div className="lg:col-span-1">
          <div className="verity-card flex flex-col overflow-hidden h-full">
            <div className="border-b border-dashed border-stone-surface p-4">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
                <TrendingUp className="h-4 w-4 text-meadow-green" />
                Trending Markets
              </h2>
            </div>

            <div className="flex flex-col grow justify-between">
              {isFeedLoading ? (
                <div className="flex flex-col animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 border-b border-dashed border-stone-surface p-4"
                    >
                      <div className="h-3 w-20 rounded bg-stone-surface" />
                      <div className="h-4 w-5/6 rounded bg-stone-surface" />
                      <div className="flex justify-between items-center mt-1">
                        <div className="h-3.5 w-12 rounded bg-stone-surface" />
                        <div className="h-3.5 w-16 rounded bg-stone-surface" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : trending.length > 0 ? (
                <div className="flex flex-col">
                  {trending.map((item) => {
                    const market = item.market
                    const yes = market
                      ? calculateYesPercent(
                          Number(market.usdc_yes_amount),
                          Number(market.usdc_no_amount),
                        )
                      : 50
                    const volume = market
                      ? Number(market.usdc_yes_amount) +
                        Number(market.usdc_no_amount)
                      : 0

                    const isPvp = market?.category?.toLowerCase() === "pvp"
                    const href = isPvp
                      ? "/markets?tab=pvp-arena"
                      : `/markets/${market?.id}`

                    return (
                      <Link
                        href={href}
                        className="flex cursor-pointer flex-col gap-2 border-b border-dashed border-stone-surface p-4 transition-colors hover:bg-parchment-card"
                        key={item.id}
                      >
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ash">
                          Trending in {market?.category || "Markets"}
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
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 text-sm text-ash">No live markets yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Navigation */}
      <section className="border-b border-border">
        <div className="flex gap-6">
          {(["overview", "tokens", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 font-semibold text-sm relative transition-colors cursor-pointer capitalize tracking-[-0.1px] ${
                activeTab === tab
                  ? "text-charcoal-primary font-bold"
                  : "text-ash hover:text-charcoal-primary"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-ember-orange rounded-full animate-fade-in" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Panels */}
      <section className="flex flex-col gap-6">
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-5">
            {/* Active Positions Summary */}
            <div className="md:col-span-3 verity-card p-5 bg-surface-solid border border-border overflow-x-auto hide-scrollbar">
              <div className="flex items-center justify-between pb-3 border-b border-stone-surface mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
                  Active Positions
                </h3>
                {positions.length > 0 && (
                  <button
                    onClick={() => setActiveTab("tokens")}
                    className="text-xs font-semibold text-ember-orange flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {positions.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-ash">
                    You hold no active outcome token stakes.
                  </p>
                  <Link
                    href="/"
                    className="verity-pill mt-4 inline-flex h-9 items-center justify-center bg-inverse px-4 text-xs font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90"
                  >
                    Browse Markets
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {recentPositions.map((pos) => {
                    const isYes = pos.side === "YES"
                    return (
                      <div
                        key={pos.id}
                        className="flex flex-col gap-3 p-3 bg-stone-surface rounded-[8px] border border-border sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className={`verity-pill inline-flex items-center px-2 py-0.5 font-mono text-[9px] font-semibold ${
                              isYes
                                ? "bg-meadow-green/10 text-meadow-green"
                                : "bg-ember-orange/10 text-ember-orange"
                            }`}
                          >
                            {pos.side}
                          </span>
                          <h4
                            className="mt-1.5 text-xs font-semibold leading-normal text-charcoal-primary truncate"
                            title={pos.market_question || ""}
                          >
                            {pos.market_question ||
                              `Market ID: ${pos.market_id.slice(0, 10)}`}
                          </h4>
                        </div>
                        <div className="flex items-center gap-4 font-mono text-xs text-right shrink-0">
                          <div>
                            <span className="block text-[8px] text-ash uppercase">
                              Shares
                            </span>
                            <span className="font-semibold">
                              {pos.shares.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-ash uppercase">
                              Value
                            </span>
                            <span className="font-semibold">
                              ${pos.currentValue.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-ash uppercase">
                              P&L
                            </span>
                            <span
                              className={`font-semibold ${pos.unrealizedPnL >= 0 ? "text-meadow-green" : "text-ember-orange"}`}
                            >
                              {pos.unrealizedPnL >= 0 ? "+" : ""}
                              {pos.unrealizedPnL.toFixed(2)}
                            </span>
                          </div>
                          <Link
                            href={
                              pos.category?.toLowerCase() === "pvp"
                                ? "/markets?tab=pvp-arena"
                                : `/markets/${pos.market_id}`
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white-surface border border-border hover:bg-stone-surface transition-colors cursor-pointer text-ash hover:text-charcoal-primary"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity Summary */}
            <div className="md:col-span-2 verity-card p-5 bg-surface-solid border border-border overflow-x-auto hide-scrollbar">
              <div className="flex items-center justify-between pb-3 border-b border-stone-surface mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
                  Recent Activity
                </h3>
                {trades && trades.length > 0 && (
                  <button
                    onClick={() => setActiveTab("activity")}
                    className="text-xs font-semibold text-ember-orange flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {recentTrades.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-ash">No recent transactions.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {recentTrades.map((t) => {
                    const isBuy = t.action === "BUY"
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p
                            className="font-semibold text-charcoal-primary truncate"
                            title={t.market_question || "Trade"}
                          >
                            {t.market_question ||
                              `Market ID: ${t.market_id.slice(0, 10)}`}
                          </p>
                          <span className="text-[10px] text-ash">
                            {isBuy ? "Bought" : "Sold"} {t.side} at{" "}
                            {t.price.toFixed(2)} USDC
                          </span>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <span
                            className={`font-semibold ${isBuy ? "text-ember-orange" : "text-meadow-green"}`}
                          >
                            {isBuy ? "-" : "+"}
                            {t.amount_usdc.toFixed(2)} USDC
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "tokens" && (
          <div className="verity-card p-5 bg-surface-solid border border-border overflow-x-auto hide-scrollbar">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-charcoal-primary mb-4 pb-3 border-b border-stone-surface">
              All Outcome Position Stakes
            </h3>

            {positions.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-ash">
                  You do not hold any outcome positions yet.
                </p>
              </div>
            ) : (
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="border-b border-stone-surface text-ash uppercase font-mono text-[9px] tracking-wider">
                    <th className="pb-3 font-semibold">Position Question</th>
                    <th className="pb-3 font-semibold">Side</th>
                    <th className="pb-3 font-semibold text-right">Shares</th>
                    <th className="pb-3 font-semibold text-right">Avg Price</th>
                    <th className="pb-3 font-semibold text-right">
                      Current Price
                    </th>
                    <th className="pb-3 font-semibold text-right">
                      Staked Cost
                    </th>
                    <th className="pb-3 font-semibold text-right">
                      Current Value
                    </th>
                    <th className="pb-3 font-semibold text-right">
                      Unrealized P&L
                    </th>
                    <th className="pb-3 font-semibold text-right">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-surface">
                  {positions.map((pos) => {
                    const isYes = pos.side === "YES"
                    return (
                      <tr
                        key={pos.id}
                        className="hover:bg-stone-surface/30 transition-colors"
                      >
                        <td
                          className="py-3.5 pr-4 max-w-[280px] font-semibold text-charcoal-primary truncate"
                          title={pos.market_question || ""}
                        >
                          {pos.market_question ||
                            `Market ${pos.market_id.slice(0, 12)}...`}
                        </td>
                        <td className="py-3.5 pr-2">
                          <span
                            className={`verity-pill inline-flex px-2 py-0.5 font-mono text-[9px] font-semibold ${
                              isYes
                                ? "bg-meadow-green/10 text-meadow-green"
                                : "bg-ember-orange/10 text-ember-orange"
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-right text-charcoal-primary">
                          {pos.shares.toFixed(2)}
                        </td>
                        <td className="py-3.5 font-mono text-right text-ash">
                          {pos.avg_price.toFixed(2)}
                        </td>
                        <td className="py-3.5 font-mono text-right text-charcoal-primary">
                          {pos.currentPrice.toFixed(2)}
                        </td>
                        <td className="py-3.5 font-mono text-right text-ash">
                          ${pos.invested_usdc.toFixed(2)}
                        </td>
                        <td className="py-3.5 font-mono text-right font-semibold text-charcoal-primary">
                          ${pos.currentValue.toFixed(2)}
                        </td>
                        <td
                          className={`py-3.5 font-mono text-right font-semibold ${pos.unrealizedPnL >= 0 ? "text-meadow-green" : "text-ember-orange"}`}
                        >
                          {pos.unrealizedPnL >= 0 ? "+" : ""}
                          {pos.unrealizedPnL.toFixed(2)}
                        </td>
                        <td className="py-3.5 text-right">
                          <Link
                            href={
                              pos.category?.toLowerCase() === "pvp"
                                ? "/markets?tab=pvp-arena"
                                : `/markets/${pos.market_id}`
                            }
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-white-surface border border-border hover:bg-stone-surface transition-colors cursor-pointer text-ash hover:text-charcoal-primary"
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="verity-card p-5 bg-surface-solid border border-border overflow-x-auto hide-scrollbar">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-charcoal-primary mb-4 pb-3 border-b border-stone-surface">
              Trade Activity History
            </h3>

            {!trades || trades.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-ash">No trade activity recorded.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-stone-surface">
                {trades.map((t) => {
                  const isBuy = t.action === "BUY"
                  const dateStr = t.created_at
                    ? new Date(t.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""

                  return (
                    <div
                      key={t.id}
                      className="py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`verity-pill inline-flex px-2 py-0.5 font-mono text-[9px] font-semibold ${
                              isBuy
                                ? "bg-ember-orange/10 text-ember-orange"
                                : "bg-meadow-green/10 text-meadow-green"
                            }`}
                          >
                            {t.action}
                          </span>
                          <span className="text-[10px] text-ash font-mono">
                            {dateStr}
                          </span>
                        </div>
                        <h4
                          className="mt-1.5 text-xs font-semibold leading-normal text-charcoal-primary truncate"
                          title={t.market_question || ""}
                        >
                          {t.market_question || `Market ID: ${t.market_id}`}
                        </h4>
                      </div>

                      <div className="flex items-center gap-6 font-mono text-xs text-right shrink-0">
                        <div>
                          <span className="block text-[8px] text-ash uppercase">
                            Shares
                          </span>
                          <span className="font-semibold text-charcoal-primary">
                            {t.shares.toFixed(2)} {t.side}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-ash uppercase">
                            Price
                          </span>
                          <span className="font-semibold text-ash">
                            {t.price.toFixed(2)} USDC
                          </span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-ash uppercase">
                            Total Amount
                          </span>
                          <span
                            className={`font-semibold ${isBuy ? "text-ember-orange" : "text-meadow-green"}`}
                          >
                            {isBuy ? "-" : "+"}
                            {t.amount_usdc.toFixed(2)} USDC
                          </span>
                        </div>
                        {t.tx_hash && (
                          <Link
                            href={`https://explorer.testnet.arc.network/tx/${t.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-stone-surface hover:bg-white-surface border border-border transition-all cursor-pointer text-ash hover:text-charcoal-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Action Modals */}
      <SendUsdcModal
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        usdcBalance={usdcBalance}
        onSuccess={refetch}
      />
      <ReceiveUsdcModal
        isOpen={isRecvOpen}
        onClose={() => setIsRecvOpen(false)}
        walletAddress={profile.walletAddress || ""}
      />
    </div>
  )
}

function calculateYesPercent(yes: number, no: number) {
  const total = yes + no
  if (total === 0) return 50
  return (yes / total) * 100
}
