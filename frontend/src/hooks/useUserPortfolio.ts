"use client";

import { useWalletProfile } from "@/hooks/useWalletProfile";
import { useUserPortfolioQuery } from "@/store/verity/verityQueries";
import { useMemo } from "react";

export function useUserPortfolio() {
  const { profile } = useWalletProfile();
  const userId = profile?.id || "";

  const { data: positions, isLoading, error, refetch } = useUserPortfolioQuery(userId);

  const stats = useMemo(() => {
    if (!positions) {
      return {
        totalPositions: 0,
        totalInvested: 0,
      };
    }

    const totalPositions = positions.length;
    const totalInvested = positions.reduce((sum, p) => sum + Number(p.invested_usdc || 0), 0);

    return {
      totalPositions,
      totalInvested,
    };
  }, [positions]);

  return {
    profile,
    positions: positions || [],
    isLoading: isLoading || !userId,
    error,
    stats,
    refetch,
  };
}
