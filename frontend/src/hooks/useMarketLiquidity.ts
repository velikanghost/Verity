"use client";

import { usePrivyWallet } from "@/hooks/usePrivyWallet";
import { type Address, encodeFunctionData } from "viem";
import { arcTestnet, arcUsdcAddress, FACTORY_ADDRESS, FPMM_ADDRESS, VAULT_ADDRESS, erc20Abi, erc1155Abi, fpmmAbi, factoryAbi, publicClient, formatWeb3Error } from "@/lib/arc";
import { useFundPoolMutation, useAddLiquidityMutation, useRemoveLiquidityMutation, useExecuteMarketTradeMutation } from "@/store/verity/verityQueries";
import { toast } from "react-hot-toast";

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "");
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`;
}

export function useMarketLiquidity() {
  const { address, isConnected, chainId, sendBatchCalls } = usePrivyWallet();

  const { mutateAsync: fundPoolBackend } = useFundPoolMutation();
  const { mutateAsync: addLiquidityBackend } = useAddLiquidityMutation();
  const { mutateAsync: removeLiquidityBackend } = useRemoveLiquidityMutation();
  const { mutateAsync: executeMarketTradeBackend } = useExecuteMarketTradeMutation();

  function checkPreconditions() {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected.");
    }
    if (chainId !== arcTestnet.id) {
      throw new Error(`Please switch to Arc Testnet (Chain ID: ${arcTestnet.id}).`);
    }
  }

  async function executeBatch(
    calls: { to: Address; data: `0x${string}` }[],
    toastId: string
  ): Promise<`0x${string}`> {
    toast.loading("Sending batched transactions to your wallet...", { id: toastId });
    const bundleHash = await sendBatchCalls(calls);
    toast.loading("Transactions submitted! Waiting for block confirmation...", { id: toastId });
    
    // Wait for the bundle completion using standard transaction receipt
    await publicClient.waitForTransactionReceipt({ hash: bundleHash });
    return bundleHash;
  }

  async function fundPreMarket(marketId: string, userId: string, amount: number, isInitialization = false) {
    checkPreconditions();

    const toastId = toast.loading(
      isInitialization
        ? "Preparing creator launch pool funding..."
        : "Preparing launch pool contribution..."
    );
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6));
      const formattedId = formatMarketId(marketId);
      const calls: { to: Address; data: `0x${string}` }[] = [];

      // Check USDC allowance to Factory
      const allowance = await publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [address as `0x${string}`, FACTORY_ADDRESS],
      });

      if (allowance < rawAmount) {
        calls.push({
          to: arcUsdcAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [FACTORY_ADDRESS, rawAmount],
          }),
        });
      }

      calls.push({
        to: FACTORY_ADDRESS,
        data: encodeFunctionData({
          abi: factoryAbi,
          args: [formattedId, rawAmount],
          functionName: "depositPreMarketLiquidity",
        }),
      });

      const hash = await executeBatch(calls, toastId);

      // Notify NestJS backend
      toast.loading("Finalizing pool deposit...", { id: toastId });
      if (isInitialization) {
        await fundPoolBackend({
          marketId,
          creatorId: userId,
          creatorWallet: address!,
          txHash: hash,
        });
      } else {
        await addLiquidityBackend({
          marketId,
          userId,
          amount,
          txHash: hash,
        });
      }

      toast.success(
        isInitialization
          ? `Successfully funded ${amount} USDC to the launch pool!`
          : `Successfully deposited ${amount} USDC to the launch pool!`,
        { id: toastId }
      );
      return hash;
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function addPoolLiquidity(marketId: string, userId: string, amount: number) {
    checkPreconditions();

    const toastId = toast.loading("Preparing liquidity pool deposit...");
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6));
      const formattedId = formatMarketId(marketId);
      const calls: { to: Address; data: `0x${string}` }[] = [];

      // Check USDC allowance to FPMM
      const allowance = await publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [address as `0x${string}`, FPMM_ADDRESS],
      });

      if (allowance < rawAmount) {
        calls.push({
          to: arcUsdcAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [FPMM_ADDRESS, rawAmount],
          }),
        });
      }

      calls.push({
        to: FPMM_ADDRESS,
        data: encodeFunctionData({
          abi: fpmmAbi,
          args: [formattedId, rawAmount],
          functionName: "addLiquidity",
        }),
      });

      const hash = await executeBatch(calls, toastId);

      // Notify NestJS backend
      toast.loading("Finalizing pool deposit...", { id: toastId });
      await addLiquidityBackend({
        marketId,
        userId,
        amount,
        txHash: hash,
      });

      toast.success(`Successfully deposited ${amount} USDC into the liquidity pool!`, { id: toastId });
      return hash;
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function removePoolLiquidity(marketId: string, userId: string, lpShares: number) {
    checkPreconditions();

    const toastId = toast.loading("Preparing liquidity pool withdrawal...");
    try {
      const rawAmount = BigInt(Math.round(lpShares * 1e6));
      const formattedId = formatMarketId(marketId);

      const calls = [{
        to: FPMM_ADDRESS,
        data: encodeFunctionData({
          abi: fpmmAbi,
          functionName: "removeLiquidity",
          args: [formattedId, rawAmount],
        }),
      }];

      const hash = await executeBatch(calls, toastId);

      // Notify NestJS backend
      toast.loading("Finalizing pool withdrawal...", { id: toastId });
      await removeLiquidityBackend({
        marketId,
        userId,
        lpShares,
        txHash: hash,
      });

      toast.success(`Successfully withdrawn ${lpShares} LP shares from the pool!`, { id: toastId });
      return hash;
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function buyTokens(
    marketId: string,
    profileId: string,
    isYes: boolean,
    amount: number,
    feeAmount: number,
    grossAmount: number
  ) {
    checkPreconditions();

    const side = isYes ? "YES" : "NO";
    const toastId = toast.loading(`Preparing ${side} token purchase...`);
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6));
      const formattedId = formatMarketId(marketId);
      const calls: { to: Address; data: `0x${string}` }[] = [];

      // Check USDC allowance to FPMM
      const allowance = await publicClient.readContract({
        abi: erc20Abi,
        address: arcUsdcAddress,
        functionName: "allowance",
        args: [address as `0x${string}`, FPMM_ADDRESS],
      });

      if (allowance < rawAmount) {
        calls.push({
          to: arcUsdcAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [FPMM_ADDRESS, rawAmount],
          }),
        });
      }

      calls.push({
        to: FPMM_ADDRESS,
        data: encodeFunctionData({
          abi: fpmmAbi,
          args: [formattedId, isYes, rawAmount],
          functionName: "buy",
        }),
      });

      const hash = await executeBatch(calls, toastId);

      // Notify NestJS backend
      toast.loading("Finalizing transaction...", { id: toastId });
      await executeMarketTradeBackend({
        marketId,
        profileId,
        side,
        action: "BUY",
        amount,
        feeAmount,
        grossAmount,
        txHash: hash,
      });

      toast.success(`Successfully bought ${side} tokens for ${amount} USDC!`, { id: toastId });
      return hash;
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  async function sellTokens(
    marketId: string,
    profileId: string,
    isYes: boolean,
    tokenAmount: number,
    netUsdcReceived: number,
    feeAmount: number
  ) {
    checkPreconditions();

    const side = isYes ? "YES" : "NO";
    const toastId = toast.loading(`Preparing ${side} token sale...`);
    try {
      const rawAmount = BigInt(Math.round(tokenAmount * 1e6));
      const formattedId = formatMarketId(marketId);
      const calls: { to: Address; data: `0x${string}` }[] = [];

      // Check if FPMM is approved as ERC1155 operator on the Vault
      const isApproved = await publicClient.readContract({
        abi: erc1155Abi,
        address: VAULT_ADDRESS,
        functionName: "isApprovedForAll",
        args: [address as `0x${string}`, FPMM_ADDRESS],
      });

      if (!isApproved) {
        calls.push({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({
            abi: erc1155Abi,
            functionName: "setApprovalForAll",
            args: [FPMM_ADDRESS, true],
          }),
        });
      }

      calls.push({
        to: FPMM_ADDRESS,
        data: encodeFunctionData({
          abi: fpmmAbi,
          functionName: "sell",
          args: [formattedId, isYes, rawAmount],
        }),
      });

      const hash = await executeBatch(calls, toastId);

      // Notify NestJS backend
      toast.loading("Finalizing transaction...", { id: toastId });
      await executeMarketTradeBackend({
        marketId,
        profileId,
        side,
        action: "SELL",
        amount: netUsdcReceived,
        grossAmount: tokenAmount,
        feeAmount,
        txHash: hash,
      });

      toast.success(`Successfully sold ${tokenAmount} ${side} tokens!`, { id: toastId });
      return hash;
    } catch (error: any) {
      toast.error(formatWeb3Error(error), { id: toastId });
      throw error;
    }
  }

  return { fundPreMarket, addPoolLiquidity, removePoolLiquidity, buyTokens, sellTokens };
}
