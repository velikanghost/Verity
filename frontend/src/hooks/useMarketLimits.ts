"use client"

import { useQuery } from "@tanstack/react-query"
import {
  publicClient,
  FACTORY_ADDRESS,
  FPMM_ADDRESS,
  factoryAbi,
  fpmmAbi,
} from "@/lib/arc"

export interface MarketLimits {
  creatorMinLock: number
  marketCreationFee: number
  minPoolBalance: number
}

export function useMarketLimits() {
  return useQuery<MarketLimits>({
    queryKey: ["marketLimits"],
    queryFn: async () => {
      try {
        const [minLockBig, feeBig, minPoolBig] = await Promise.all([
          publicClient.readContract({
            address: FPMM_ADDRESS,
            abi: fpmmAbi,
            functionName: "creatorMinLock",
          }),
          publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: factoryAbi,
            functionName: "marketCreationFee",
          }),
          publicClient.readContract({
            address: FPMM_ADDRESS,
            abi: fpmmAbi,
            functionName: "minPoolBalance",
          }),
        ])

        return {
          creatorMinLock: Number(minLockBig) / 1e6,
          marketCreationFee: Number(feeBig) / 1e6,
          minPoolBalance: Number(minPoolBig) / 1e6,
        }
      } catch (error) {
        console.error("Failed to fetch market limits from contract:", error)
        return {
          creatorMinLock: 5,
          marketCreationFee: 1,
          minPoolBalance: 20,
        }
      }
    },
    staleTime: 60000, // 1 minute cache
  })
}
