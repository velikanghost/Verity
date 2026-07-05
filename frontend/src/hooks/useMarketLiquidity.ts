"use client"

import { useAuth } from "@/components/providers/AuthModals"
import {
  arcUsdcAddress,
  FACTORY_ADDRESS,
  FPMM_ADDRESS,
  VAULT_ADDRESS,
  publicClient,
  erc20Abi,
} from "@/lib/arc"
import { maxUint256 } from "viem"
import { conditionalTokenVaultAbi } from "@/lib/contracts-generated"
import {
  useFundPoolMutation,
  useAddLiquidityMutation,
  useRemoveLiquidityMutation,
  useExecuteMarketTradeMutation,
} from "@/store/verity/verityQueries"
import { toast } from "@/lib/toast"

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
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user!.walletAddress as `0x${string}`, FACTORY_ADDRESS],
      })

      if (allowance < rawAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FACTORY_ADDRESS, maxUint256],
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
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user!.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      if (allowance < rawAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, maxUint256],
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

  async function batchAddPoolLiquidity(
    deposits: Array<{ marketId: string; amount: number }>,
    userId: string,
  ) {
    checkPreconditions()

    if (deposits.length === 0) return;

    const totalAmount = deposits.reduce((sum, d) => sum + d.amount, 0)
    const toastId = toast.loading("Preparing batch liquidity deposit...")
    try {
      const rawTotalAmount = BigInt(Math.round(totalAmount * 1e6))
      const calls: Array<{
        contractAddress: string
        abiFunctionSignature: string
        abiParameters: any[]
      }> = []

      // Check USDC allowance to FPMM
      const allowance = await publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user!.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      if (allowance < rawTotalAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, maxUint256],
        })
      }

      deposits.forEach((dep) => {
        const formattedId = formatMarketId(dep.marketId)
        const rawAmount = BigInt(Math.round(dep.amount * 1e6))
        calls.push({
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "addLiquidity(bytes32,uint256)",
          abiParameters: [formattedId, rawAmount],
        })
      })

      toast.dismiss(toastId)

      const hash = await executeTxBatch(
        calls,
        `Deposit ${totalAmount} USDC into Liquidity Pools`,
        totalAmount,
      )

      // Notify NestJS backend for each deposit
      const finalizeToastId = toast.loading("Finalizing pool deposits...")
      await Promise.all(
        deposits.map((dep) =>
          addLiquidityBackend({
            marketId: dep.marketId,
            userId,
            amount: dep.amount,
            txHash: hash,
          }),
        ),
      )
      toast.dismiss(finalizeToastId)

      toast.success(
        `Successfully deposited ${totalAmount} USDC into liquidity pools!`,
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
    isYesOrIndex: boolean | number,
    amount: number,
    feeAmount: number,
    grossAmount: number,
    customSide?: string,
  ) {
    checkPreconditions()

    const isMulti = typeof isYesOrIndex === "number"
    const side = customSide || (isYesOrIndex === true ? "YES" : "NO")
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
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [user!.walletAddress as `0x${string}`, FPMM_ADDRESS],
      })

      if (allowance < rawAmount) {
        calls.push({
          contractAddress: arcUsdcAddress,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [FPMM_ADDRESS, maxUint256],
        })
      }

      if (isMulti) {
        calls.push({
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "buyOutcome(bytes32,uint256,uint256)",
          abiParameters: [formattedId, BigInt(isYesOrIndex), rawAmount],
        })
      } else {
        calls.push({
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "buy(bytes32,bool,uint256)",
          abiParameters: [formattedId, isYesOrIndex, rawAmount],
        })
      }

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
    isYesOrIndex: boolean | number,
    tokenAmount: number,
    netUsdcReceived: number,
    feeAmount: number,
    customSide?: string,
  ) {
    checkPreconditions()

    const isMulti = typeof isYesOrIndex === "number"
    const side = customSide || (isYesOrIndex === true ? "YES" : "NO")
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
        abi: conditionalTokenVaultAbi,
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

      if (isMulti) {
        calls.push({
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "sellOutcome(bytes32,uint256,uint256)",
          abiParameters: [formattedId, BigInt(isYesOrIndex), rawAmount],
        })
      } else {
        calls.push({
          contractAddress: FPMM_ADDRESS,
          abiFunctionSignature: "sell(bytes32,bool,uint256)",
          abiParameters: [formattedId, isYesOrIndex, rawAmount],
        })
      }

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
    batchAddPoolLiquidity,
    removePoolLiquidity,
    buyTokens,
    sellTokens,
  }
}
