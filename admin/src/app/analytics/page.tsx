"use client"

import { useState, useEffect } from "react"
import { apiRequest } from "@/store/apiClient"
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
} from "lucide-react"

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
}

export default function AnalyticsPage() {
  const [metricsData, setMetricsData] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchMetricsData(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const data = await apiRequest<AdminMetrics>("/pvp/public-metrics")
      setMetricsData(data)
    } catch (err: any) {
      console.error("Failed to load analytics metrics:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchMetricsData()
  }, [])

  if (loading && !metricsData) {
    return (
      <div className="flex flex-col gap-6 animate-pulse w-full max-w-5xl mx-auto py-10 px-4">
        <div className="h-10 bg-stone-200 rounded-lg w-1/3 mb-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-stone-200 rounded-xl" />
          ))}
        </div>
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
        <p className="text-sm font-medium text-stone-500">
          Failed to load platform analytics.
        </p>
        <button
          onClick={() => fetchMetricsData()}
          className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
        >
          Refresh Metrics
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full max-w-6xl mx-auto py-10 px-4">
      {/* Analytics top section */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            Verity Analytics
          </h1>
        </div>

        <button
          onClick={() => fetchMetricsData(true)}
          disabled={refreshing}
          className="h-10 w-10 rounded-xl hover:bg-stone-100 bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-950 transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4.5 w-4.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="verity-card p-5 bg-white flex flex-col gap-2 shadow-xs border border-stone-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Registered Users
            </span>
            <Users className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-extrabold text-stone-900 font-mono">
            {metricsData.users.real}
          </span>
          <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1 border-t border-stone-100 pt-2">
            <span>Verified unique accounts</span>
          </div>
        </div>

        {/* PvP Active Players */}
        <div className="verity-card p-5 bg-white flex flex-col gap-2 shadow-xs border border-stone-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              PvP Arena Players
            </span>
            <Swords className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-extrabold text-stone-900 font-mono">
            {metricsData.pvpUsers.played.real}
          </span>
          <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1 border-t border-stone-100 pt-2">
            <span>Players with matched duels</span>
          </div>
        </div>

        {/* Total PvP Duels */}
        <div className="verity-card p-5 bg-white flex flex-col gap-2 shadow-xs border border-stone-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              PvP Matches Count
            </span>
            <Trophy className="h-4.5 w-4.5 text-indigo-600" />
          </div>
          <span className="text-2xl font-extrabold text-stone-900 font-mono">
            {metricsData.pvpMatchesCount}
          </span>
          <div className="text-[11px] text-stone-500 mt-1 border-t border-stone-100 pt-2">
            Total PvP ticket submissions
          </div>
        </div>

        {/* Combined revenue */}
        <div className="verity-card p-5 bg-emerald-50/50 border border-emerald-100 flex flex-col gap-2 shadow-xs rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Total Platform Revenue
            </span>
            <Coins className="h-4.5 w-4.5 text-emerald-600" />
          </div>
          <span className="text-2xl font-extrabold text-emerald-950 font-mono">
            {metricsData.volumeAndFees.combinedFees.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USDC
          </span>
          <div className="flex items-center justify-between text-[11px] text-emerald-800 mt-1 border-t border-emerald-100/55 pt-2">
            <span>
              Trades: {metricsData.volumeAndFees.overallFees.toFixed(2)}
            </span>
            <span>
              Creation:{" "}
              {metricsData.volumeAndFees.creationFeesCollected.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Sub row detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Financial performance detail card */}
        <div className="verity-card p-6 bg-white lg:col-span-7 flex flex-col gap-5 border border-stone-200 shadow-xs rounded-2xl">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 border-b border-stone-100 pb-3">
            <DollarSign className="h-4.5 w-4.5 text-indigo-600" />
            Detailed USDC Trading Volume & Fee Breakdowns
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Volume breakdown */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                USDC Trading Volume
              </h4>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <span className="text-xs text-stone-600 font-semibold">
                    Standard Markets
                  </span>
                  <span className="text-xs font-bold font-mono text-stone-900">
                    {metricsData.volumeAndFees.standardVolume.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    USDC
                  </span>
                </div>
                <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <span className="text-xs text-stone-600 font-semibold">
                    PvP Child Markets
                  </span>
                  <span className="text-xs font-bold font-mono text-stone-900">
                    {metricsData.volumeAndFees.pvpVolume.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    USDC
                  </span>
                </div>
                <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-3 rounded-xl mt-1">
                  <span className="text-xs text-indigo-800 font-bold">
                    Total Volume
                  </span>
                  <span className="text-xs font-extrabold font-mono text-indigo-955">
                    {metricsData.volumeAndFees.overallVolume.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    USDC
                  </span>
                </div>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="flex flex-col gap-3">
              <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-indigo-500" />
                Fees Collected
              </h4>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <span className="text-xs text-stone-600 font-semibold">
                    Standard Trading Fees
                  </span>
                  <span className="text-xs font-bold font-mono text-stone-900">
                    {metricsData.volumeAndFees.standardFees.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    USDC
                  </span>
                </div>
                <div className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <span className="text-xs text-stone-600 font-semibold">
                    Market Creation Fees
                  </span>
                  <span className="text-xs font-bold font-mono text-stone-950">
                    {metricsData.volumeAndFees.creationFeesCollected.toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    USDC
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PvP ticket submission stats card */}
        <div className="verity-card p-6 bg-white lg:col-span-5 flex flex-col gap-4 border border-stone-200 shadow-xs rounded-2xl">
          <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2 border-b border-stone-100 pb-3">
            <Layers className="h-4.5 w-4.5 text-indigo-600" />
            PvP Arena Player Funnel
          </h3>

          <div className="flex flex-col gap-4 py-2">
            {/* Ticket submission funnel bars using real users only */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-600">Total Users Registered</span>
                <span className="text-stone-950 font-mono">
                  {metricsData.users.real}
                </span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200/10">
                <div className="bg-indigo-600 h-full rounded-full w-full" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-600">
                  Submitted at Least One Ticket
                </span>
                <span className="text-stone-950 font-mono">
                  {metricsData.pvpUsers.submitted.real} (
                  {(
                    (metricsData.pvpUsers.submitted.real /
                      (metricsData.users.real || 1)) *
                    100
                  ).toFixed(0)}
                  %)
                </span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200/10">
                <div
                  className="bg-indigo-500 h-full rounded-full"
                  style={{
                    width: `${(metricsData.pvpUsers.submitted.real / (metricsData.users.real || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-stone-600">Matched/Played PvP Match</span>
                <span className="text-stone-950 font-mono">
                  {metricsData.pvpUsers.played.real} (
                  {(
                    (metricsData.pvpUsers.played.real /
                      (metricsData.users.real || 1)) *
                    100
                  ).toFixed(0)}
                  %)
                </span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200/10">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${(metricsData.pvpUsers.played.real / (metricsData.users.real || 1)) * 100}%`,
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
