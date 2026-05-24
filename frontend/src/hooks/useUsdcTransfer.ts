"use client";

import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { type Address } from "viem";
import { arcTestnet, arcUsdcAddress, erc20Abi, FACTORY_ADDRESS, factoryAbi, ROUTER_ADDRESS, routerAbi } from "@/lib/arc";

export function useUsdcTransfer() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();

  async function transferToTreasury(amount: number) {
    if (!isConnected || !address) {
      throw new Error("Connect your wallet first.");
    }

    if (chainId !== arcTestnet.id) {
      throw new Error("Switch to Arc Testnet before sending USDC.");
    }

    if (!publicClient) {
      throw new Error("Arc RPC client is not ready.");
    }

    const treasuryAddress = process.env.NEXT_PUBLIC_VERITY_TREASURY_ADDRESS as Address;
    if (!treasuryAddress) {
      throw new Error("Set NEXT_PUBLIC_VERITY_TREASURY_ADDRESS in .env before paid USDC actions.");
    }

    const rawAmount = BigInt(Math.round(amount * 1e6));

    const hash = await writeContractAsync({
      abi: erc20Abi,
      address: arcUsdcAddress,
      args: [treasuryAddress, rawAmount],
      chainId: arcTestnet.id,
      functionName: "transfer",
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, treasuryAddress };
  }

  async function createMarketPreDeposit(marketId: string, creatorLpAmount: number) {
    if (!isConnected || !address) {
      throw new Error("Connect your wallet first.");
    }

    if (chainId !== arcTestnet.id) {
      throw new Error("Switch to Arc Testnet.");
    }

    if (!publicClient) {
      throw new Error("Arc RPC client is not ready.");
    }

    // 1 USDC fee + creatorLpAmount
    const totalRequired = BigInt(Math.round((creatorLpAmount + 1) * 1e6));

    // Check allowance for ROUTER_ADDRESS
    const allowance = await publicClient.readContract({
      address: arcUsdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address, ROUTER_ADDRESS],
    });

    if (allowance < totalRequired) {
      // Approve max uint256 to ROUTER_ADDRESS so they only approve once globally
      const approveHash = await writeContractAsync({
        abi: erc20Abi,
        address: arcUsdcAddress,
        args: [ROUTER_ADDRESS, BigInt("115792089237316195423570985008687907853269984665640564039457584007913129639935")],
        chainId: arcTestnet.id,
        functionName: "approve",
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    const formattedMarketId = ("0x" + marketId.padEnd(64, "0")) as Address;

    const hash = await writeContractAsync({
      abi: routerAbi,
      address: ROUTER_ADDRESS,
      args: [FACTORY_ADDRESS, formattedMarketId, BigInt(Math.round(creatorLpAmount * 1e6))],
      chainId: arcTestnet.id,
      functionName: "createMarketPreDeposit",
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, factoryAddress: FACTORY_ADDRESS };
  }

  return { transferToTreasury, createMarketPreDeposit };
}

