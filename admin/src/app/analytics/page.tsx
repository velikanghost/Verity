"use client"

import { useState, useEffect, useMemo } from "react"
import { apiRequest } from "@/store/apiClient"
import { io } from "socket.io-client"
import {
  RefreshCw,
  Trophy,
  Swords,
  Users,
  Layers,
  Coins,
  BarChart4,
  TrendingUp,
  Clock,
} from "lucide-react"
import VolumeLineChart from "@/components/VolumeLineChart"
import UserActivityBarChart from "@/components/UserActivityBarChart"

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

export default function AnalyticsPage() {
  const [metricsData, setMetricsData] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeframe, setTimeframe] = useState<string>("7d")
  const [contractBalances, setContractBalances] = useState<{
    fpmmUsdcBalance: number
    factoryUsdcBalance: number
  } | null>(null)
  const [contractBalancesLoading, setContractBalancesLoading] = useState(false)

  // Fetch metrics data
  async function fetchMetricsData(isRefresh = false, selectedTimeframe?: string) {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const tf = selectedTimeframe || timeframe
      const data = await apiRequest<AdminMetrics>(`/pvp/public-metrics?timeframe=${tf}`)
      setMetricsData(data)
    } catch (err: any) {
      console.error("Failed to load analytics metrics:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Fetch contract balances
  async function fetchContractBalances() {
    setContractBalancesLoading(true)
    try {
      // Contract balances endpoint requires admin authentication
      const data = await apiRequest<{
        fpmmUsdcBalance: number
        factoryUsdcBalance: number
      }>("/pvp/contract-balances")
      setContractBalances(data)
    } catch (err: any) {
      console.error("Failed to fetch contract balances for analytics:", err)
    } finally {
      setContractBalancesLoading(false)
    }
  }

  // Initial fetch and timeframe selection trigger
  useEffect(() => {
    void fetchMetricsData(false, timeframe)
    void fetchContractBalances()
  }, [timeframe])

  // Real-time socket updates listener
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5080"
    const socket = io(`${socketUrl}/socket`, {
      transports: ["websocket"],
    })

    socket.on("connect", () => {
      console.log("Analytics page connected to socket")
      socket.emit("join-room", "feed")
    })

    socket.on("feed-updated", () => {
      console.log("Analytics page received feed-updated event, refreshing...")
      void fetchMetricsData(true)
      void fetchContractBalances()
    })

    return () => {
      socket.disconnect()
    }
  }, [timeframe])

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

  if (loading && !metricsData) {
    return (
      <div className="flex flex-col gap-6 animate-pulse w-full max-w-6xl mx-auto py-10 px-4">
        <div className="h-10 bg-stone-200 rounded-lg w-1/3 mb-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-stone-200 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-stone-200 rounded-xl mt-4" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
          <div className="h-64 bg-stone-200 rounded-xl lg:col-span-7" />
          <div className="h-64 bg-stone-200 rounded-xl lg:col-span-5" />
        </div>
      </div>
    )
  }

  if (!metricsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white border border-stone-200 rounded-2xl max-w-md mx-auto shadow-sm my-20">
        <p className="text-sm font-medium text-stone-500 font-bold">
          Failed to load platform analytics.
        </p>
        <button
          onClick={() => fetchMetricsData(true)}
          className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
        >
          Refresh Metrics
        </button>
      </div>
    )
  }

  const totalBetsCount = metricsData.pvpMatchesCount + (metricsData.recentTrades?.length || 0)

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-6xl mx-auto py-10 px-4">
      {/* Analytics top section */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            Verity Analytics
          </h1>
          <p className="text-xs text-stone-500 mt-1">
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
            onClick={() => fetchMetricsData(true)}
            disabled={refreshing}
            className="h-10 w-10 rounded-xl hover:bg-stone-100 bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-950 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Summary Row (5 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
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

        {/* Unclaimed Rewards */}
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

      {/* Main Cumulative Volume Chart */}
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
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-500">Registered Accounts</span>
                <span className="text-stone-950 font-mono font-bold font-semibold">{metricsData.users.real}</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full w-full" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-500">Submitted tickets</span>
                <span className="text-stone-950 font-mono font-bold font-semibold">
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
                <span className="text-stone-950 font-mono font-bold font-semibold">
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
