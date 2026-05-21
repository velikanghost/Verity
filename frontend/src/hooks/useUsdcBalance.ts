"use client";

import { useAccount, useReadContract } from "wagmi";
import { arcUsdcAddress, erc20Abi } from "@/lib/arc";

export function useUsdcBalance() {
  const { address, isConnected } = useAccount();

  const { data, refetch, isLoading } = useReadContract({
    address: arcUsdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && Boolean(address),
    },
  });

  const rawBalance = data ? BigInt(data.toString()) : BigInt(0);
  // USDC has 6 decimals on Arc Testnet
  const formattedBalance = (Number(rawBalance) / 1e6).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

  return {
    rawBalance,
    formattedBalance,
    isLoading,
    refetch,
  };
}
