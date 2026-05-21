"use client";

import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { type Address } from "viem";
import { arcTestnet, arcUsdcAddress, FACTORY_ADDRESS, FPMM_ADDRESS, VAULT_ADDRESS, erc20Abi, erc1155Abi, factoryAbi, fpmmAbi } from "@/lib/arc";
import { useFundPoolMutation, useAddLiquidityMutation, useRemoveLiquidityMutation, useExecuteMarketTradeMutation } from "@/store/verity/verityQueries";
import { toast } from "react-hot-toast";

function formatMarketId(marketId: string): `0x${string}` {
  const clean = marketId.replace(/^0x/, "");
  return `0x${clean.padEnd(64, "0")}` as `0x${string}`;
}

export function useMarketLiquidity() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();

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
      const approvalHash = await writeContractAsync({
        abi: erc20Abi,
        address: arcUsdcAddress,
        chainId: arcTestnet.id,
        functionName: "approve",
        args: [spender, rawAmount],
      });

      toast.loading("Approval transaction sent! Waiting for confirmation...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash: approvalHash });
      toast.success("USDC approved successfully!", { id: toastId });
    }
  }

  async function fundPreMarket(marketId: string, userId: string, amount: number, isInitialization = false) {
    checkPreconditions();

    const toastId = toast.loading(
      isInitialization
        ? "Preparing pre-market creator escrow fund..."
        : "Preparing pre-market escrow contribution..."
    );
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6));

      // 1. Approve USDC transfer to Factory contract
      await approveIfNecessary(FACTORY_ADDRESS, rawAmount, toastId);

      // 2. Deposit pre-market liquidity
      toast.loading(`Please confirm the ${amount} USDC deposit in your wallet...`, { id: toastId });
      const formattedId = formatMarketId(marketId);
      const hash = await writeContractAsync({
        abi: factoryAbi,
        address: FACTORY_ADDRESS,
        args: [formattedId, rawAmount],
        chainId: arcTestnet.id,
        functionName: "depositPreMarketLiquidity",
      });

      toast.loading("Deposit transaction sent! Waiting for block confirmation...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash });

      // 3. Notify NestJS backend
      toast.loading("Transaction confirmed on-chain! Registering escrow with database...", { id: toastId });
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
          ? `Successfully funded ${amount} USDC to pre-market escrow!`
          : `Successfully deposited ${amount} USDC to pre-market escrow!`,
        { id: toastId }
      );
      return hash;
    } catch (error: any) {
      const errMsg = error.message || "Failed to fund pre-market escrow.";
      toast.error(errMsg.slice(0, 120), { id: toastId });
      throw error;
    }
  }

  async function addPoolLiquidity(marketId: string, userId: string, amount: number) {
    checkPreconditions();

    const toastId = toast.loading("Preparing liquidity pool deposit...");
    try {
      const rawAmount = BigInt(Math.round(amount * 1e6));

      // 1. Approve USDC transfer to FPMM contract
      await approveIfNecessary(FPMM_ADDRESS, rawAmount, toastId);

      // 2. Add liquidity
      toast.loading(`Please confirm the ${amount} USDC deposit in your wallet...`, { id: toastId });
      const formattedId = formatMarketId(marketId);
      const hash = await writeContractAsync({
        abi: fpmmAbi,
        address: FPMM_ADDRESS,
        args: [formattedId, rawAmount],
        chainId: arcTestnet.id,
        functionName: "addLiquidity",
      });

      toast.loading("Deposit transaction sent! Waiting for block confirmation...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash });

      // 3. Notify NestJS backend
      toast.loading("Transaction confirmed on-chain! Syncing pool state with database...", { id: toastId });
      await addLiquidityBackend({
        marketId,
        userId,
        amount,
        txHash: hash,
      });

      toast.success(`Successfully deposited ${amount} USDC into the liquidity pool!`, { id: toastId });
      return hash;
    } catch (error: any) {
      const errMsg = error.message || "Failed to deposit liquidity.";
      toast.error(errMsg.slice(0, 120), { id: toastId });
      throw error;
    }
  }

  async function removePoolLiquidity(marketId: string, userId: string, lpShares: number) {
    checkPreconditions();

    const toastId = toast.loading("Preparing liquidity pool withdrawal...");
    try {
      const rawAmount = BigInt(Math.round(lpShares * 1e6));

      // 1. Remove liquidity on-chain
      toast.loading(`Please confirm withdrawal of ${lpShares} LP shares in your wallet...`, { id: toastId });
      const formattedId = formatMarketId(marketId);
      const hash = await writeContractAsync({
        abi: fpmmAbi,
        address: FPMM_ADDRESS,
        args: [formattedId, rawAmount],
        chainId: arcTestnet.id,
        functionName: "removeLiquidity",
      });

      toast.loading("Withdrawal transaction sent! Waiting for block confirmation...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash });

      // 2. Notify NestJS backend
      toast.loading("Transaction confirmed on-chain! Updating pool balance and shares...", { id: toastId });
      await removeLiquidityBackend({
        marketId,
        userId,
        lpShares,
        txHash: hash,
      });

      toast.success(`Successfully withdrawn ${lpShares} LP shares from the pool!`, { id: toastId });
      return hash;
    } catch (error: any) {
      const errMsg = error.message || "Failed to withdraw liquidity.";
      toast.error(errMsg.slice(0, 120), { id: toastId });
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

      // 1. Approve FPMM to spend USDC
      await approveIfNecessary(FPMM_ADDRESS, rawAmount, toastId);

      // 2. Buy tokens from FPMM
      toast.loading(`Please confirm the ${amount} USDC ${side} purchase in your wallet...`, { id: toastId });
      const formattedId = formatMarketId(marketId);
      const hash = await writeContractAsync({
        abi: fpmmAbi,
        address: FPMM_ADDRESS,
        args: [formattedId, isYes, rawAmount],
        chainId: arcTestnet.id,
        functionName: "buy",
      });

      toast.loading("Trade submitted! Waiting for block confirmation...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash });

      // 3. Notify NestJS backend
      toast.loading("Transaction confirmed on-chain! Updating trade history and position...", { id: toastId });
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
      const errMsg = error.message || `Failed to buy ${side} tokens.`;
      toast.error(errMsg.slice(0, 120), { id: toastId });
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

      // 1. Approve FPMM as ERC1155 operator on the Vault (if not already)
      toast.loading("Checking token approval...", { id: toastId });
      const isApproved = await publicClient!.readContract({
        abi: erc1155Abi,
        address: VAULT_ADDRESS,
        functionName: "isApprovedForAll",
        args: [address!, FPMM_ADDRESS],
      });

      if (!isApproved) {
        toast.loading("Token approval required. Please approve in your wallet...", { id: toastId });
        const approvalHash = await writeContractAsync({
          abi: erc1155Abi,
          address: VAULT_ADDRESS,
          chainId: arcTestnet.id,
          functionName: "setApprovalForAll",
          args: [FPMM_ADDRESS, true],
        });
        toast.loading("Approval sent! Waiting for confirmation...", { id: toastId });
        await publicClient!.waitForTransactionReceipt({ hash: approvalHash });
      }

      // 2. Sell tokens on FPMM
      toast.loading(`Please confirm sale of ${tokenAmount} ${side} tokens in your wallet...`, { id: toastId });
      const formattedId = formatMarketId(marketId);
      const hash = await writeContractAsync({
        abi: fpmmAbi,
        address: FPMM_ADDRESS,
        args: [formattedId, isYes, rawAmount],
        chainId: arcTestnet.id,
        functionName: "sell",
      });

      toast.loading("Sale submitted! Waiting for block confirmation...", { id: toastId });
      await publicClient!.waitForTransactionReceipt({ hash });

      // 3. Notify NestJS backend
      toast.loading("Transaction confirmed on-chain! Updating trade history and position...", { id: toastId });
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
      const errMsg = error.message || `Failed to sell ${side} tokens.`;
      toast.error(errMsg.slice(0, 120), { id: toastId });
      throw error;
    }
  }

  return { fundPreMarket, addPoolLiquidity, removePoolLiquidity, buyTokens, sellTokens };
}
