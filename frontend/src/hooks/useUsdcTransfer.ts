"use client";

import { usePrivyWallet } from "@/hooks/usePrivyWallet";
import { type Address, encodeFunctionData } from "viem";
import { arcTestnet, arcUsdcAddress, erc20Abi, FACTORY_ADDRESS, factoryAbi, publicClient } from "@/lib/arc";

export function useUsdcTransfer() {
  const { address, isConnected, chainId, sendBatchCalls } = usePrivyWallet();

  function checkPreconditions() {
    if (!isConnected || !address) {
      throw new Error("Connect your wallet first.");
    }
    if (chainId !== arcTestnet.id) {
      throw new Error("Switch to Arc Testnet before initiating transactions.");
    }
  }

  async function transferToTreasury(amount: number) {
    checkPreconditions();

    const treasuryAddress = process.env.NEXT_PUBLIC_VERITY_TREASURY_ADDRESS as Address;
    if (!treasuryAddress) {
      throw new Error("Set NEXT_PUBLIC_VERITY_TREASURY_ADDRESS in .env before paid USDC actions.");
    }

    const rawAmount = BigInt(Math.round(amount * 1e6));

    const hash = await sendBatchCalls([
      {
        to: arcUsdcAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [treasuryAddress, rawAmount],
        }),
      },
    ]);

    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, treasuryAddress };
  }

  async function createMarketPreDeposit(marketId: string, creatorLpAmount: number) {
    checkPreconditions();

    const totalRequired = BigInt(Math.round((creatorLpAmount + 1) * 1e6));
    const formattedMarketId = ("0x" + marketId.padEnd(64, "0")) as Address;
    const calls: { to: Address; data: `0x${string}` }[] = [];

    // Check USDC allowance to Factory
    const allowance = await publicClient.readContract({
      address: arcUsdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address as `0x${string}`, FACTORY_ADDRESS],
    });

    if (allowance < totalRequired) {
      calls.push({
        to: arcUsdcAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [FACTORY_ADDRESS, totalRequired],
        }),
      });
    }

    calls.push({
      to: FACTORY_ADDRESS,
      data: encodeFunctionData({
        abi: factoryAbi,
        functionName: "createMarketPreDeposit",
        args: [formattedMarketId, BigInt(Math.round(creatorLpAmount * 1e6))],
      }),
    });

    const hash = await sendBatchCalls(calls);
    await publicClient.waitForTransactionReceipt({ hash });
    
    return { hash, factoryAddress: FACTORY_ADDRESS };
  }

  return { transferToTreasury, createMarketPreDeposit };
}
