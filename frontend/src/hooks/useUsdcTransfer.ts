"use client"

import { useAuth } from "@/components/providers/AuthModals"
import { type Address } from "viem"
import {
  arcUsdcAddress,
  FACTORY_ADDRESS,
  publicClient,
  factoryAbi,
} from "@/lib/arc"

export function useUsdcTransfer() {
  const { user, executeTxBatch } = useAuth()

  function checkPreconditions() {
    if (!user) {
      throw new Error("Connect your wallet first.")
    }
  }

  async function transferToTreasury(amount: number) {
    checkPreconditions()

    const treasuryAddress = process.env
      .NEXT_PUBLIC_VERITY_TREASURY_ADDRESS as Address
    if (!treasuryAddress) {
      throw new Error(
        "Set NEXT_PUBLIC_VERITY_TREASURY_ADDRESS in .env before paid USDC actions.",
      )
    }

    const rawAmount = BigInt(Math.round(amount * 1e6))

    const hash = await executeTxBatch(
      [
        {
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "transfer(address,uint256)",
          abiParameters: [treasuryAddress, rawAmount],
        },
      ],
      `Transfer ${amount} USDC to treasury`,
      amount,
    )

    return { hash, treasuryAddress }
  }

  async function createMarketPreDeposit(
    marketId: string,
    creatorLpAmount: number,
    deferClose = false,
  ) {
    checkPreconditions()

    let creationFee = BigInt(1000000) // 1 USDC fallback
    try {
      const fee = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "marketCreationFee",
      })
      creationFee = fee
    } catch (e) {
      console.error("Failed to read marketCreationFee from contract:", e)
    }

    const totalRequired =
      BigInt(Math.round(creatorLpAmount * 1e6)) + creationFee
    const formattedMarketId = ("0x" + marketId.padEnd(64, "0")) as Address
    const calls: Array<{
      contractAddress: string
      abiFunctionSignature: string
      abiParameters: any[]
    }> = []

    // Check USDC allowance to Factory
    const allowance = await publicClient.readContract({
      address: arcUsdcAddress,
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
      functionName: "allowance",
      args: [user!.walletAddress as `0x${string}`, FACTORY_ADDRESS],
    })

    if (allowance < totalRequired) {
      calls.push({
        contractAddress: arcUsdcAddress,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [FACTORY_ADDRESS, totalRequired],
      })
    }

    calls.push({
      contractAddress: FACTORY_ADDRESS,
      abiFunctionSignature: "createMarketPreDeposit(bytes32,uint256)",
      abiParameters: [
        formattedMarketId,
        BigInt(Math.round(creatorLpAmount * 1e6)),
      ],
    })

    const hash = await executeTxBatch(
      calls,
      `Create Market & Pre-Deposit ${creatorLpAmount} USDC Liquidity`,
      creatorLpAmount + Number(creationFee) / 1e6,
      undefined,
      deferClose,
    )

    return { hash, factoryAddress: FACTORY_ADDRESS }
  }

  async function transferUsdc(recipientAddress: string, amount: number) {
    checkPreconditions()

    if (!recipientAddress.startsWith("0x") || recipientAddress.length !== 42) {
      throw new Error("Invalid recipient wallet address.")
    }

    const rawAmount = BigInt(Math.round(amount * 1e6))

    const hash = await executeTxBatch(
      [
        {
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "transfer(address,uint256)",
          abiParameters: [recipientAddress as Address, rawAmount],
        },
      ],
      `Transfer ${amount} USDC to ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
      amount,
    )

    return { hash }
  }

  return { transferToTreasury, createMarketPreDeposit, transferUsdc }
}
