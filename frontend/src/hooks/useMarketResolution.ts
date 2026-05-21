"use client";

import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { type Address } from "viem";
import { arcTestnet, arcUsdcAddress, RESOLVER_ADDRESS, VAULT_ADDRESS, FPMM_ADDRESS, erc20Abi, resolverAbi, vaultAbi, fpmmAbi } from "@/lib/arc";
import { toast } from "react-hot-toast";

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "");
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`;
}

export function useMarketResolution() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();

  function checkPreconditions() {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected.");
    }
    if (chainId !== arcTestnet.id) {
      throw new Error(`Please switch to Arc Testnet (Chain ID: ${arcTestnet.id}).`);
    }
  }

  async function approveIfNecessary(spender: Address, rawAmount: bigint, toastId: string) {
    toast.loading("Checking USDC approval...", { id: toastId });
    const currentAllowance = await publicClient!.readContract({
      abi: erc20Abi,
      address: arcUsdcAddress,
      functionName: "allowance",
      args: [address!, spender],
    });

    if (currentAllowance < rawAmount) {
      toast.loading("USDC approval required. Please approve in your wallet...", { id: toastId });
      const txHash = await writeContractAsync({
        abi: erc20Abi,
        address: arcUsdcAddress,
        chainId: arcTestnet.id,
        functionName: "approve",
        args: [spender, rawAmount],
      });

      toast.loading("Verifying USDC approval on-chain...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      toast.success("USDC approval confirmed!", { id: toastId });
    }
  }

  async function disputeResolution(marketId: string) {
    const toastId = toast.loading("Preparing to dispute resolution proposal...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      // Read bond amount
      toast.loading("Reading resolution bond amount...", { id: toastId });
      const bondAmount = await publicClient!.readContract({
        abi: resolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "resolutionBond",
      });

      // Approve bond spending
      await approveIfNecessary(RESOLVER_ADDRESS, bondAmount, toastId);

      // Dispute proposal
      toast.loading("Sending dispute transaction...", { id: toastId });
      const txHash = await writeContractAsync({
        abi: resolverAbi,
        address: RESOLVER_ADDRESS,
        args: [formattedMarketId],
        chainId: arcTestnet.id,
        functionName: "disputeResolution",
      });

      toast.loading("Waiting for dispute confirmation on-chain...", { id: toastId });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Resolution proposal disputed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      const msg = error?.shortMessage || error?.message || "Dispute failed.";
      toast.error(`Dispute failed: ${msg}`, { id: toastId });
      throw error;
    }
  }

  async function redeemWinnings(marketId: string) {
    const toastId = toast.loading("Preparing to redeem winnings...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      toast.loading("Sending redemption transaction...", { id: toastId });
      const txHash = await writeContractAsync({
        abi: vaultAbi,
        address: VAULT_ADDRESS,
        args: [formattedMarketId],
        chainId: arcTestnet.id,
        functionName: "redeem",
      });

      toast.loading("Waiting for redemption confirmation on-chain...", { id: toastId });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Winnings redeemed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      const msg = error?.shortMessage || error?.message || "Redemption failed.";
      toast.error(`Redemption failed: ${msg}`, { id: toastId });
      throw error;
    }
  }

  async function claimCreatorLP(marketId: string) {
    const toastId = toast.loading("Preparing to claim locked creator liquidity...");
    try {
      checkPreconditions();
      const formattedMarketId = formatMarketId(marketId);

      toast.loading("Sending creator claim transaction...", { id: toastId });
      const txHash = await writeContractAsync({
        abi: fpmmAbi,
        address: FPMM_ADDRESS,
        args: [formattedMarketId],
        chainId: arcTestnet.id,
        functionName: "claimCreatorLiquidity",
      });

      toast.loading("Waiting for claim confirmation on-chain...", { id: toastId });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      
      toast.success("Creator liquidity claimed successfully! ✓", { id: toastId });
      return { txHash, receipt };
    } catch (error: any) {
      const msg = error?.shortMessage || error?.message || "Claim failed.";
      toast.error(`Claim failed: ${msg}`, { id: toastId });
      throw error;
    }
  }

  async function readProposal(marketId: string) {
    try {
      const formattedMarketId = formatMarketId(marketId);
      const result = await publicClient!.readContract({
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
      const result = await publicClient!.readContract({
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
    readProposal,
    readResolutionBond,
  };
}
