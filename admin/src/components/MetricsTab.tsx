"use client"

import React, { useMemo } from "react"
import {
  RefreshCw,
  Trophy,
  Swords,
  Users,
  Layers,
  Coins,
  DollarSign,
  BarChart4,
  TrendingUp,
  Clock,
  Briefcase,
} from "lucide-react"
import VolumeLineChart from "./VolumeLineChart"
import UserActivityBarChart from "./UserActivityBarChart"

interface AdminMetrics {
  users: {
    total: number
    real: number
    bots: number
  }
  pvpUsers: {
    submitted: {
      total: number
      real: number
      bots: number
    }
    played: {
      total: number
      real: number
      bots: number
    }
  }
  pvpMatchesCount: number
  volumeAndFees: {
    overallVolume: number
    overallFees: number
    standardVolume: number
    standardFees: number
    pvpVolume: number
    pvpFees: number
    creationFeesCollected: number
    combinedFees: number
  }
  recentTrades: {
    marketId: string
    marketQuestion: string
    amountUsdc: number
    createdAt: string
  }[]
  activityTimeline: {
    label: string
    signups: number
    trades: number
    tickets: number
  }[]
}

interface MetricsTabProps {
  metricsLoading: boolean
  metricsData: AdminMetrics | null
  fetchMetricsData: () => void
  timeframe: string
  setTimeframe: (tf: string) => void
  contractBalances: {
    fpmmUsdcBalance: number
    factoryUsdcBalance: number
    adminUsdcBalance: number
    adminAddress: string
  } | null
  contractBalancesLoading: boolean
}

export default function MetricsTab({
  metricsLoading,
  metricsData,
  fetchMetricsData,
  timeframe,
  setTimeframe,
  contractBalances,
  contractBalancesLoading,
}: MetricsTabProps) {
  // Calculate unique active markets count
  const activeMarketsCount = useMemo(() => {
    if (!metricsData?.recentTrades) return 0
    const ids = new Set(metricsData.recentTrades.map((t) => t.marketId))
    return ids.size
  }, [metricsData])

  // Calculate unclaimed rewards / payout contract balances
  const unclaimedRewards = useMemo(() => {
    if (!contractBalances) return 0
    return contractBalances.fpmmUsdcBalance + contractBalances.factoryUsdcBalance
  }, [contractBalances])

  if (metricsLoading && !metricsData) {
    return (
      <div className="verity-card p-16 text-center text-sm text-stone-500 animate-pulse font-medium bg-white border border-stone-200 shadow-xs rounded-2xl">
        Loading database metrics...
      </div>
    )
  }

  if (!metricsData) {
    return (
      <div className="verity-card p-16 text-center text-sm text-stone-400 font-medium bg-white border border-stone-200 shadow-xs rounded-2xl">
        Failed to load platform metrics. Click refresh to retry.
        <button
          onClick={fetchMetricsData}
          className="mt-4 px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer mx-auto block"
        >
          Refresh Metrics
        </button>
      </div>
    )
  }

  // Format bets count: PvP tickets count + standard trades count
  const totalBetsCount = metricsData.pvpMatchesCount + (metricsData.recentTrades?.length || 0)

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Metrics Header & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-150 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <BarChart4 className="h-5 w-5 text-indigo-600" />
            Platform Analytics
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Real-time on-chain volume, active wallets, trading stats, and contract balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Timeframe selector pills */}
          <div className="bg-stone-100 p-0.5 rounded-xl border border-stone-200 flex items-center">
            {["1h", "1d", "7d", "30d"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  timeframe === tf
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200/50"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={fetchMetricsData}
            disabled={metricsLoading}
            className="h-8.5 w-8.5 rounded-xl hover:bg-stone-50 bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-950 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${metricsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Summary Row (Inspiration style - 5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Volume */}
        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
              Total Volume
            </span>
            <TrendingUp className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-stone-950 font-mono tracking-tight">
            {metricsData.volumeAndFees.overallVolume.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </span>
          <span className="text-[10px] font-semibold text-stone-450 mt-1">
            {activeMarketsCount} active markets
          </span>
        </div>

        {/* Total Users */}
        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
              Total Users
            </span>
            <Users className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-stone-950 font-mono tracking-tight">
            {metricsData.users.real}
          </span>
          <span className="text-[10px] font-semibold text-stone-450 mt-1">
            Unique registered wallets
          </span>
        </div>

        {/* Total Bets */}
        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
              Total Bets
            </span>
            <Trophy className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-stone-950 font-mono tracking-tight">
            {totalBetsCount}
          </span>
          <span className="text-[10px] font-semibold text-stone-450 mt-1">
            Across all active markets
          </span>
        </div>

        {/* Platform Fees Collected */}
        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
              Fees Collected
            </span>
            <Coins className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-stone-950 font-mono tracking-tight">
            {metricsData.volumeAndFees.combinedFees.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </span>
          <span className="text-[10px] font-semibold text-stone-450 mt-1">
            Standard & Creation fees
          </span>
        </div>

        {/* Unclaimed Rewards (Contract balances) */}
        <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
              Unclaimed Rewards
            </span>
            <Clock className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-stone-950 font-mono tracking-tight">
            {contractBalancesLoading ? (
              <span className="text-xs text-stone-400 animate-pulse">Loading...</span>
            ) : (
              `${unclaimedRewards.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} USDC`
            )}
          </span>
          <span className="text-[10px] font-semibold text-stone-450 mt-1">
            Balances in payout contracts
          </span>
        </div>
      </div>

      {/* Main Cumulative Volume Chart (Full width) */}
      <VolumeLineChart trades={metricsData.recentTrades} timeframe={timeframe} />

      {/* Grouped User Activity & Funnel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Activity Bar Chart */}
        <div className="lg:col-span-7">
          <UserActivityBarChart activityTimeline={metricsData.activityTimeline} />
        </div>

        {/* PvP Funnel Chart */}
        <div className="verity-card p-6 bg-white lg:col-span-5 flex flex-col gap-4 border border-stone-200 shadow-xs rounded-2xl">
          <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 pb-3">
            <Layers className="h-4 w-4 text-indigo-600" />
            PvP Arena Player Funnel
          </h3>

          <div className="flex flex-col gap-4 py-2">
            {/* Registered -> Submitted -> Played Funnel */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-500">Registered Accounts</span>
                <span className="text-stone-950 font-mono font-bold">{metricsData.users.real}</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-650 h-full rounded-full w-full" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-500">Submitted tickets</span>
                <span className="text-stone-950 font-mono font-bold">
                  {metricsData.pvpUsers.submitted.real} (
                  {(
                    (metricsData.pvpUsers.submitted.real / (metricsData.users.real || 1)) *
                    100
                  ).toFixed(0)}
                  %)
                </span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full"
                  style={{
                    width: `${
                      (metricsData.pvpUsers.submitted.real / (metricsData.users.real || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-500">Matched/Played matches</span>
                <span className="text-stone-950 font-mono font-bold">
                  {metricsData.pvpUsers.played.real} (
                  {(
                    (metricsData.pvpUsers.played.real / (metricsData.users.real || 1)) *
                    100
                  ).toFixed(0)}
                  %)
                </span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${
                      (metricsData.pvpUsers.played.real / (metricsData.users.real || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
