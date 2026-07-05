"use client"

import { useAuth } from "@/components/providers/AuthModals"

import {
  arcUsdcAddress,
  RESOLVER_ADDRESS,
  VAULT_ADDRESS,
  FPMM_ADDRESS,
  FACTORY_ADDRESS,
  publicClient,
  erc20Abi,
} from "@/lib/arc"
import { maxUint256 } from "viem"
import { verityOptimisticResolverAbi } from "@/lib/contracts-generated"
import { toast } from "@/lib/toast"

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "")
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`
}

export function useMarketResolution() {
  const { user, executeTxBatch } = useAuth()

  function checkPreconditions() {
    if (!user) {
      throw new Error("Wallet not connected.")
    }
  }

  async function disputeResolution(marketId: string) {
    const toastId = toast.loading("Preparing to dispute resolution proposal...")
    try {
      checkPreconditions()
      const formattedMarketId = formatMarketId(marketId)

      // Read bond amount
      const bondAmount = await publicClient.readContract({
        abi: verityOptimisticResolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "resolutionBond",
      })

      const calls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // Check USDC allowance to Resolver
      const allowance = await publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user!.walletAddress as `0x${string}`, RESOLVER_ADDRESS],
      })

      if (allowance < bondAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [RESOLVER_ADDRESS, maxUint256],
        })
      }

      calls.push({
        contractAddress: RESOLVER_ADDRESS,
        abiFunctionSignature: "disputeResolution(bytes32)",
        abiParameters: [formattedMarketId],
      })

      toast.dismiss(toastId)

      const estimatedCost = Number(bondAmount) / 1e6
      const txHash = await executeTxBatch(
        calls,
        `Dispute Resolution Proposal (Bond: ${estimatedCost} USDC)`,
        estimatedCost,
      )

      toast.success("Resolution proposal disputed successfully!")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Dispute failed.")
      }
      throw error
    }
  }

  async function redeemWinnings(marketId: string, claimAmountUsdc?: number) {
    const toastId = toast.loading("Preparing to redeem winnings...")
    try {
      checkPreconditions()
      const formattedMarketId = formatMarketId(marketId)

      toast.dismiss(toastId)

      const txHash = await executeTxBatch(
        [
          {
            contractAddress: VAULT_ADDRESS,
            abiFunctionSignature: "redeem(bytes32)",
            abiParameters: [formattedMarketId],
          },
        ],
        "Redeem Winnings from Vault",
        0, // No USDC paid (USDC is redeemed/received)
        claimAmountUsdc,
      )

      toast.success("Winnings redeemed!")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Redemption failed.")
      }
      throw error
    }
  }

  async function redeemMultipleWinnings(
    marketIds: string[],
    claimAmountUsdc?: number,
  ) {
    const toastId = toast.loading("Preparing to redeem multiple winnings...")
    try {
      checkPreconditions()
      const calls = marketIds.map((marketId) => ({
        contractAddress: VAULT_ADDRESS,
        abiFunctionSignature: "redeem(bytes32)",
        abiParameters: [formatMarketId(marketId)],
      }))

      toast.dismiss(toastId)

      const txHash = await executeTxBatch(
        calls,
        `Redeem ${marketIds.length} winnings`,
        0, // No USDC paid
        claimAmountUsdc,
      )

      toast.success("All winnings redeemed successfully!")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Redemption failed.")
      }
      throw error
    }
  }

  async function claimCreatorLP(marketId: string, claimAmountUsdc?: number) {
    const toastId = toast.loading(
      "Preparing to claim locked creator liquidity...",
    )
    try {
      checkPreconditions()
      const formattedMarketId = formatMarketId(marketId)

      toast.dismiss(toastId)

      const txHash = await executeTxBatch(
        [
          {
            contractAddress: FPMM_ADDRESS,
            abiFunctionSignature: "claimCreatorLiquidity(bytes32)",
            abiParameters: [formattedMarketId],
          },
        ],
        "Claim Locked Creator LP Liquidity",
        0, // No USDC paid
        claimAmountUsdc,
      )

      toast.success("Creator liquidity claimed successfully!")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "LP claim failed.")
      }
      throw error
    }
  }

  async function claimRefund(marketId: string, claimAmountUsdc?: number) {
    const toastId = toast.loading("Preparing to claim pre-market refund...")
    try {
      checkPreconditions()
      const formattedMarketId = formatMarketId(marketId)

      toast.dismiss(toastId)

      const txHash = await executeTxBatch(
        [
          {
            contractAddress: FACTORY_ADDRESS,
            abiFunctionSignature: "claimRefund(bytes32)",
            abiParameters: [formattedMarketId],
          },
        ],
        "Claim Pre-Market Deposit Refund",
        0, // No USDC paid
        claimAmountUsdc,
      )

      toast.success("USDC refund claimed successfully!")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Claim refund failed.")
      }
      throw error
    }
  }

  async function readProposal(marketId: string) {
    try {
      const formattedMarketId = formatMarketId(marketId)
      const result = await publicClient.readContract({
        abi: verityOptimisticResolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "proposals",
        args: [formattedMarketId],
      })
      const [
        proposer,
        proposedOutcomeIndex,
        proposalTime,
        disputed,
        disputer,
        finalized,
      ] = result as [string, bigint, bigint, boolean, string, boolean]

      const proposedWinningOutcome = proposedOutcomeIndex === BigInt(0)

      return {
        proposer,
        proposedWinningOutcome,
        proposalTime: Number(proposalTime),
        disputed,
        disputer,
        finalized,
      }
    } catch (error) {
      console.error("Error reading proposal from contract:", error)
      return null
    }
  }

  async function readResolutionBond() {
    try {
      const result = await publicClient.readContract({
        abi: verityOptimisticResolverAbi,
        address: RESOLVER_ADDRESS,
        functionName: "resolutionBond",
      })
      return Number(result) / 1e6 // USDC is 6 decimals
    } catch (error) {
      console.error("Error reading resolution bond from contract:", error)
      return 10.0 // default 10 USDC
    }
  }

  return {
    disputeResolution,
    redeemWinnings,
    redeemMultipleWinnings,
    claimCreatorLP,
    claimRefund,
    readProposal,
    readResolutionBond,
  }
}
