"use client";

import type { Address } from "viem";
import { formatUnits, isAddress } from "viem";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { arcTestnet, arcUsdcAddress, hasArcWalletConfig } from "@/lib/arc";

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export function useUsdcBalance() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const enabled =
    isConnected &&
    Boolean(address) &&
    hasArcWalletConfig() &&
    isAddress(arcUsdcAddress);

  const rawBalance = useReadContract({
    abi: erc20Abi,
    address: enabled ? (arcUsdcAddress as Address) : undefined,
    args: address ? [address] : undefined,
    chainId: arcTestnet.id,
    functionName: "balanceOf",
    query: {
      enabled,
      refetchInterval: 15_000,
    },
  });

  const decimals = useReadContract({
    abi: erc20Abi,
    address: enabled ? (arcUsdcAddress as Address) : undefined,
    chainId: arcTestnet.id,
    functionName: "decimals",
    query: {
      enabled,
      staleTime: Infinity,
    },
  });

  const formattedValue =
    rawBalance.data !== undefined
      ? Number(formatUnits(rawBalance.data, decimals.data ?? 6)).toLocaleString(undefined, { maximumFractionDigits: 4 })
      : "0";

  return {
    address,
    isConnected,
    chainId,
    isArcTestnet: chainId === arcTestnet.id,
    balance: {
      data: rawBalance.data,
      error: rawBalance.error || decimals.error,
      isLoading: rawBalance.isLoading || decimals.isLoading,
    },
    formatted: formattedValue,
  };
}
