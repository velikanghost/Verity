"use client"

import { useAuth } from "@/components/providers/AuthModals"

import {
  arcUsdcAddress,
  RESOLVER_ADDRESS,
  VAULT_ADDRESS,
  FPMM_ADDRESS,
  FACTORY_ADDRESS,
  publicClient,
} from "@/lib/arc"
import { toast } from "react-hot-toast"

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
        abi: [
          {
            name: "resolutionBond",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "uint256" }],
          },
        ] as const,
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
        abi: [
          {
            name: "allowance",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" },
            ],
            outputs: [{ name: "", type: "uint256" }],
          },
        ] as const,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user!.walletAddress as `0x${string}`, RESOLVER_ADDRESS],
      })

      if (allowance < bondAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [RESOLVER_ADDRESS, bondAmount],
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

      toast.success("Resolution proposal disputed successfully! ✓")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Dispute failed.")
      }
      throw error
    }
  }

  async function redeemWinnings(marketId: string) {
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
      )

      toast.success("Winnings redeemed successfully! ✓")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Redemption failed.")
      }
      throw error
    }
  }

  async function claimCreatorLP(marketId: string) {
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
      )

      toast.success("Creator liquidity claimed successfully! ✓")
      return { txHash }
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "LP claim failed.")
      }
      throw error
    }
  }

  async function claimRefund(marketId: string) {
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
      )

      toast.success("USDC refund claimed successfully! ✓")
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
        abi: [
          {
            name: "proposals",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "", type: "bytes32" }],
            outputs: [
              { name: "proposer", type: "address" },
              { name: "proposedWinningOutcome", type: "bool" },
              { name: "proposalTime", type: "uint256" },
              { name: "disputed", type: "bool" },
              { name: "disputer", type: "address" },
              { name: "finalized", type: "bool" },
            ],
          },
        ] as const,
        address: RESOLVER_ADDRESS,
        functionName: "proposals",
        args: [formattedMarketId],
      })
      const [
        proposer,
        proposedWinningOutcome,
        proposalTime,
        disputed,
        disputer,
        finalized,
      ] = result as [string, boolean, bigint, boolean, string, boolean]

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
        abi: [
          {
            name: "resolutionBond",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "uint256" }],
          },
        ] as const,
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
    claimCreatorLP,
    claimRefund,
    readProposal,
    readResolutionBond,
  }
}
