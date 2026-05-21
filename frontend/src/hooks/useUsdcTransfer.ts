"use client";

import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { type Address } from "viem";
import { arcTestnet, arcUsdcAddress, erc20Abi } from "@/lib/arc";

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

  return { transferToTreasury };
}
