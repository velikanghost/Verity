"use client"

import { useAuth } from "@/components/providers/AuthModals"
import {
  arcUsdcAddress,
  FACTORY_ADDRESS,
  FPMM_ADDRESS,
  VAULT_ADDRESS,
  publicClient,
} from "@/lib/arc"
import {
  useFundPoolMutation,
  useAddLiquidityMutation,
  useRemoveLiquidityMutation,
  useExecuteMarketTradeMutation,
} from "@/store/verity/verityQueries"
import { toast } from "react-hot-toast"

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "")
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`
}

export function useMarketLiquidity() {
  const { user, executeTxBatch } = useAuth()

  const { mutateAsync: fundPoolBackend } = useFundPoolMutation()
  const { mutateAsync: addLiquidityBackend } = useAddLiquidityMutation()
  const { mutateAsync: removeLiquidityBackend } = useRemoveLiquidityMutation()
  const { mutateAsync: executeMarketTradeBackend } =
    useExecuteMarketTradeMutation()

  function checkPreconditions() {
    if (!user) {
      throw new Error("Wallet not connected.")
    }
  }

  async function fundPreMarket(
    marketId: string,
    userId: string,
    amount: number,
    isInitialization = false,
  ) {
    checkPreconditions()

    const toastId = toast.loading(
      isInitialization
        ? "Preparing creator launch pool funding..."
        : "Preparing launch pool contribution...",
    )
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6))
      const formattedId = formatMarketId(marketId)
      const calls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // Check USDC allowance to Factory
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
        args: [user!.walletAddress as `0x${string}`, FACTORY_ADDRESS],
      })

      if (allowance < rawAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FACTORY_ADDRESS, rawAmount],
        })
      }

      calls.push({
        contractAddress: FACTORY_ADDRESS,
        abiFunctionSignature: "depositPreMarketLiquidity(bytes32,uint256)",
        abiParameters: [formattedId, rawAmount],
      })

      toast.dismiss(toastId)

      const hash = await executeTxBatch(
        calls,
        isInitialization
          ? `Fund Launch Pool with ${amount} USDC`
          : `Deposit ${amount} USDC into Launch Pool`,
        amount,
      )

      // Notify NestJS backend
      const finalizeToastId = toast.loading("Finalizing pool deposit...")
      if (isInitialization) {
        await fundPoolBackend({
          marketId,
          creatorId: userId,
          creatorWallet: user!.walletAddress!,
          txHash: hash,
        })
      } else {
        await addLiquidityBackend({
          marketId,
          userId,
          amount,
          txHash: hash,
        })
      }
      toast.dismiss(finalizeToastId)

      toast.success(
        isInitialization
          ? `Successfully funded ${amount} USDC to the launch pool!`
          : `Successfully deposited ${amount} USDC to the launch pool!`,
      )
      return hash
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Failed to fund pre-market.")
      }
      throw error
    }
  }

  async function addPoolLiquidity(
    marketId: string,
    userId: string,
    amount: number,
  ) {
    checkPreconditions()

    const toastId = toast.loading("Preparing liquidity pool deposit...")
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6))
      const formattedId = formatMarketId(marketId)
      const calls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // Check USDC allowance to FPMM
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
        args: [user!.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      if (allowance < rawAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, rawAmount],
        })
      }

      calls.push({
        contractAddress: FPMM_ADDRESS,
        abiFunctionSignature: "addLiquidity(bytes32,uint256)",
        abiParameters: [formattedId, rawAmount],
      })

      toast.dismiss(toastId)

      const hash = await executeTxBatch(
        calls,
        `Deposit ${amount} USDC into Liquidity Pool`,
        amount,
      )

      // Notify NestJS backend
      const finalizeToastId = toast.loading("Finalizing pool deposit...")
      await addLiquidityBackend({
        marketId,
        userId,
        amount,
        txHash: hash,
      })
      toast.dismiss(finalizeToastId)

      toast.success(
        `Successfully deposited ${amount} USDC into the liquidity pool!`,
      )
      return hash
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Failed to add liquidity.")
      }
      throw error
    }
  }

  async function removePoolLiquidity(
    marketId: string,
    userId: string,
    lpShares: number,
  ) {
    checkPreconditions()

    const toastId = toast.loading("Preparing liquidity pool withdrawal...")
    try {
      const rawAmount = BigInt(Math.round(lpShares * 1e6))
      const formattedId = formatMarketId(marketId)

      const calls = [
        {
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "removeLiquidity(bytes32,uint256)",
          abiParameters: [formattedId, rawAmount],
        },
      ]

      toast.dismiss(toastId)

      const hash = await executeTxBatch(
        calls,
        `Withdraw ${lpShares} LP Shares from Pool`,
        0, // LP shares, not USDC paid
      )

      // Notify NestJS backend
      const finalizeToastId = toast.loading("Finalizing pool withdrawal...")
      await removeLiquidityBackend({
        marketId,
        userId,
        lpShares,
        txHash: hash,
      })
      toast.dismiss(finalizeToastId)

      toast.success(
        `Successfully withdrawn ${lpShares} LP shares from the pool!`,
      )
      return hash
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Failed to remove liquidity.")
      }
      throw error
    }
  }

  async function buyTokens(
    marketId: string,
    profileId: string,
    isYes: boolean,
    amount: number,
    feeAmount: number,
    grossAmount: number,
  ) {
    checkPreconditions()

    const side = isYes ? "YES" : "NO"
    const toastId = toast.loading(`Preparing ${side} token purchase...`)
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6))
      const formattedId = formatMarketId(marketId)
      const calls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // Check USDC allowance to FPMM
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
        args: [user!.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      if (allowance < rawAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, rawAmount],
        })
      }

      calls.push({
        contractAddress: FPMM_ADDRESS,
        abiFunctionSignature: "buy(bytes32,bool,uint256)",
        abiParameters: [formattedId, isYes, rawAmount],
      })

      toast.dismiss(toastId)

      const hash = await executeTxBatch(
        calls,
        `Buy ${side} Shares for ${amount} USDC`,
        amount,
      )

      // Notify NestJS backend
      const finalizeToastId = toast.loading("Finalizing transaction...")
      await executeMarketTradeBackend({
        marketId,
        profileId,
        side,
        action: "BUY",
        amount,
        feeAmount,
        grossAmount,
        txHash: hash,
      })
      toast.dismiss(finalizeToastId)

      toast.success(`Successfully bought ${side} tokens for ${amount} USDC!`)
      return hash
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Failed to buy shares.")
      }
      throw error
    }
  }

  async function sellTokens(
    marketId: string,
    profileId: string,
    isYes: boolean,
    tokenAmount: number,
    netUsdcReceived: number,
    feeAmount: number,
  ) {
    checkPreconditions()

    const side = isYes ? "YES" : "NO"
    const toastId = toast.loading(`Preparing ${side} token sale...`)
    try {
      const rawAmount = BigInt(Math.round(tokenAmount * 1e6))
      const formattedId = formatMarketId(marketId)
      const calls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // Check if FPMM is approved as ERC1155 operator on the Vault
      const isApproved = await publicClient.readContract({
        abi: [
          {
            name: "isApprovedForAll",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "account", type: "address" },
              { name: "operator", type: "address" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const,
        address: VAULT_ADDRESS,
        functionName: "isApprovedForAll",
        args: [user!.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      if (!isApproved) {
        calls.push({
          contractAddress: VAULT_ADDRESS,
          abiFunctionSignature: "setApprovalForAll(address,bool)",
          abiParameters: [FPMM_ADDRESS, true],
        })
      }

      calls.push({
        contractAddress: FPMM_ADDRESS,
        abiFunctionSignature: "sell(bytes32,bool,uint256)",
        abiParameters: [formattedId, isYes, rawAmount],
      })

      toast.dismiss(toastId)

      const hash = await executeTxBatch(
        calls,
        `Sell ${tokenAmount} ${side} Shares`,
        0, // No USDC paid (USDC is received)
      )

      // Notify NestJS backend
      const finalizeToastId = toast.loading("Finalizing transaction...")
      await executeMarketTradeBackend({
        marketId,
        profileId,
        side,
        action: "SELL",
        amount: netUsdcReceived,
        grossAmount: tokenAmount,
        feeAmount,
        txHash: hash,
      })
      toast.dismiss(finalizeToastId)

      toast.success(`Successfully sold ${tokenAmount} ${side} tokens!`)
      return hash
    } catch (error: any) {
      toast.dismiss(toastId)
      if (!error.message?.includes("rejected")) {
        toast.error(error.message || "Failed to sell shares.")
      }
      throw error
    }
  }

  return {
    fundPreMarket,
    addPoolLiquidity,
    removePoolLiquidity,
    buyTokens,
    sellTokens,
  }
}
