"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/AuthModals"
import { arcUsdcAddress, erc20Abi, publicClient } from "@/lib/arc"

export function useUsdcBalance() {
  const { user } = useAuth()
  const address = user?.walletAddress

  const query = useQuery({
    queryKey: ["usdcBalance", address],
    queryFn: async () => {
      if (!address) return BigInt(0)
      const data = await publicClient.readContract({
        address: arcUsdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      })
      return BigInt(data.toString())
    },
    enabled: !!address,
    refetchInterval: 5000, // Refetch balance every 5 seconds for real-time updates
  })

  const rawBalance = query.data ?? BigInt(0)

  // USDC has 6 decimals on Arc Testnet
  const formattedBalance = (Number(rawBalance) / 1e6).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    },
  )

  return {
    rawBalance,
    formattedBalance,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
