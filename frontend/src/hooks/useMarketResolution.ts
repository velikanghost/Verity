"use client";

import { usePrivyWallet } from "@/hooks/usePrivyWallet";
import { type Address, encodeFunctionData } from "viem";
import { arcTestnet, arcUsdcAddress, RESOLVER_ADDRESS, VAULT_ADDRESS, FPMM_ADDRESS, FACTORY_ADDRESS, ROUTER_ADDRESS, erc20Abi, resolverAbi, vaultAbi, fpmmAbi, factoryAbi, routerAbi, publicClient, formatWeb3Error } from "@/lib/arc";
import { toast } from "react-hot-toast";

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "");
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`;
}

export function useMarketResolution() {
  const { address, isConnected, chainId, sendBatchCalls } = usePrivyWallet();

  function checkPreconditions() {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected.");
    }
    if (chainId !== arcTestnet.id) {
      throw new Error(`Please switch to Arc Testnet (Chain ID: ${arcTestnet.id}).`);
    }
  }

  async function disputeResolution(marketId: string) {
    const toastId = toast.loading("Preparing to dispute resolution proposal...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      // Read bond amount
      toast.loading("Reading resolution bond amount...", { id: toastId });
      const bondAmount = await publicClient.readContract({
        abi: resolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "resolutionBond",
      });

      const calls: { to: Address; data: `0x${string}` }[] = [];

      // Check USDC allowance to Router
      const allowance = await publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [address as `0x${string}`, ROUTER_ADDRESS],
      });

      if (allowance < bondAmount) {
        calls.push({
          to: arcUsdcAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [ROUTER_ADDRESS, bondAmount],
          }),
        });
      }

      calls.push({
        to: ROUTER_ADDRESS,
        data: encodeFunctionData({
          abi: routerAbi,
          args: [RESOLVER_ADDRESS, formattedMarketId],
          functionName: "disputeResolution",
        }),
      });

      toast.loading("Submitting dispute transaction batch...", { id: toastId });
      const txHash = await sendBatchCalls(calls);

      toast.loading("Waiting for dispute confirmation on-chain...", { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Resolution proposal disputed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function redeemWinnings(marketId: string) {
    const toastId = toast.loading("Preparing to redeem winnings...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      toast.loading("Sending redemption transaction...", { id: toastId });
      const txHash = await sendBatchCalls([
        {
          to: VAULT_ADDRESS,
          data: encodeFunctionData({
            abi: vaultAbi,
            functionName: "redeem",
            args: [formattedMarketId],
          }),
        },
      ]);

      toast.loading("Waiting for redemption confirmation on-chain...", { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Winnings redeemed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function claimCreatorLP(marketId: string) {
    const toastId = toast.loading("Preparing to claim locked creator liquidity...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      toast.loading("Sending creator claim transaction...", { id: toastId });
      const txHash = await sendBatchCalls([
        {
          to: FPMM_ADDRESS,
          data: encodeFunctionData({
            abi: fpmmAbi,
            functionName: "claimCreatorLiquidity",
            args: [formattedMarketId],
          }),
        },
      ]);

      toast.loading("Waiting for claim confirmation on-chain...", { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Creator liquidity claimed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function claimRefund(marketId: string) {
    const toastId = toast.loading("Preparing to claim pre-market refund...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      toast.loading("Sending refund claim transaction...", { id: toastId });
      const txHash = await sendBatchCalls([
        {
          to: FACTORY_ADDRESS,
          data: encodeFunctionData({
            abi: factoryAbi,
            functionName: "claimRefund",
            args: [formattedMarketId],
          }),
        },
      ]);

      toast.loading("Waiting for refund confirmation on-chain...", { id: toastId });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("USDC refund claimed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function readProposal(marketId: string) {
    try {
      const formattedMarketId = formatMarketId(marketId);
      const result = await publicClient.readContract({
        abi: resolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "proposals",
        args: [formattedMarketId],
      });
      const [
        proposer,
        proposedWinningOutcome,
        proposalTime,
        disputed,
        disputer,
        finalized,
      ] = result as [string, boolean, bigint, boolean, string, boolean];

      return {
        proposer,
        proposedWinningOutcome,
        proposalTime: Number(proposalTime),
        disputed,
        disputer,
        finalized,
      };
    } catch (error) {
      console.error("Error reading proposal from contract:", error);
      return null;
    }
  }

  async function readResolutionBond() {
    try {
      const result = await publicClient.readContract({
        abi: resolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "resolutionBond",
      });
      return Number(result) / 1e6; // USDC is 6 decimals
    } catch (error) {
      console.error("Error reading resolution bond from contract:", error);
      return 10.0; // default 10 USDC
    }
  }

  return {
    disputeResolution,
    redeemWinnings,
    claimCreatorLP,
    claimRefund,
    readProposal,
    readResolutionBond,
  };
}
