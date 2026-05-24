"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import {
  ROUTER_ADDRESS,
  arcTestnet,
  arcUsdcAddress,
  erc20Abi,
} from "@/lib/arc";

const MAX_UINT_256 =
  BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935");

const ACTIVATED_ALLOWANCE_FLOOR = MAX_UINT_256 / BigInt(2);

export function useTradingActivation() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const isArcTestnet = chainId === arcTestnet.id;

  const allowanceQuery = useQuery({
    queryKey: ["trading-activation", address, ROUTER_ADDRESS] as const,
    queryFn: async () => {
      if (!address || !publicClient) return BigInt(0);
      return publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [address, ROUTER_ADDRESS],
      });
    },
    enabled: Boolean(isConnected && address && publicClient && isArcTestnet),
    refetchInterval: 30_000,
  });

  const activationMutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect your wallet first.");
      if (!publicClient) throw new Error("Arc RPC is not ready yet.");
      if (!isArcTestnet) {
        throw new Error(`Switch to Arc Testnet (${arcTestnet.id}) first.`);
      }

      const txHash = await writeContractAsync({
        abi: erc20Abi,
        address: arcUsdcAddress,
        chainId: arcTestnet.id,
        functionName: "approve",
        args: [ROUTER_ADDRESS, MAX_UINT_256],
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["trading-activation", address, ROUTER_ADDRESS],
      });
    },
  });

  const allowance = allowanceQuery.data ?? BigInt(0);

  return {
    activateTrading: activationMutation.mutateAsync,
    activationError: activationMutation.error,
    allowance,
    isActivated: allowance >= ACTIVATED_ALLOWANCE_FLOOR,
    isActivating: activationMutation.isPending,
    isArcTestnet,
    isChecking: allowanceQuery.isLoading || allowanceQuery.isFetching,
    refetchActivation: allowanceQuery.refetch,
  };
}
