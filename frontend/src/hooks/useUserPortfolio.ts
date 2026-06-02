"use client"

import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useUserPortfolioQuery } from "@/store/verity/verityQueries"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { getMarketPrice } from "@/lib/verity"
import { useMemo } from "react"

export function useUserPortfolio() {
  const { profile } = useWalletProfile()
  const userId = profile?.id || ""

  const {
    data: rawPositions,
    isLoading: isPositionsLoading,
    error,
    refetch: refetchPositions,
  } = useUserPortfolioQuery(userId)
  const {
    rawBalance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useUsdcBalance()

  const usdcBalance = Number(rawBalance) / 1e6

  const positions = useMemo(() => {
    if (!rawPositions) return []

    return rawPositions.map((p) => {
      const currentPrice =
        p.status === "resolved"
          ? p.resolved_outcome === p.side
            ? 1.0
            : 0.0
          : getMarketPrice(
              {
                usdc_yes_amount: p.usdc_yes_amount ?? 0,
                usdc_no_amount: p.usdc_no_amount ?? 0,
              },
              p.side,
            )
      const currentValue = p.shares * currentPrice
      const unrealizedPnL = currentValue - (p.invested_usdc || 0)

      return {
        ...p,
        currentPrice,
        currentValue,
        unrealizedPnL,
      }
    })
  }, [rawPositions])

  const stats = useMemo(() => {
    if (positions.length === 0) {
      return {
        totalPositions: 0,
        totalInvested: 0,
        holdingsValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        netWorth: usdcBalance,
      }
    }

    const totalPositions = positions.length
    const totalInvested = positions.reduce(
      (sum, p) => sum + Number(p.invested_usdc || 0),
      0,
    )
    const holdingsValue = positions.reduce(
      (sum, p) => sum + Number(p.currentValue || 0),
      0,
    )
    const unrealizedPnL = holdingsValue - totalInvested
    const realizedPnL = positions.reduce(
      (sum, p) => sum + Number(p.realized_pnl || 0),
      0,
    )
    const netWorth = usdcBalance + holdingsValue

    return {
      totalPositions,
      totalInvested,
      holdingsValue,
      unrealizedPnL,
      realizedPnL,
      netWorth,
    }
  }, [positions, usdcBalance])

  const refetch = async () => {
    await Promise.all([refetchPositions(), refetchBalance()])
  }

  return {
    profile,
    positions,
    isLoading: isPositionsLoading || isBalanceLoading || !userId,
    error,
    stats,
    usdcBalance,
    refetch,
  }
}
