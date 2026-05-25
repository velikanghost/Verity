"use client";

import { useEffect, useState } from "react";
import { usePrivyWallet } from "@/hooks/usePrivyWallet";
import { arcUsdcAddress, erc20Abi, publicClient } from "@/lib/arc";

export function useUsdcBalance() {
  const { address, isConnected } = usePrivyWallet();
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);

  const refetch = async () => {
    if (!address) {
      setBalance(BigInt(0));
      return;
    }
    setIsLoading(true);
    try {
      const data = await publicClient.readContract({
        address: arcUsdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      setBalance(BigInt(data.toString()));
    } catch (err) {
      console.error("Error reading USDC balance:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      refetch();
    } else {
      setBalance(BigInt(0));
    }
  }, [address, isConnected]);

  const rawBalance = balance;
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
