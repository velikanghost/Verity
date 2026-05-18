"use client";

import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { arcTestnet } from "@/lib/arc";
import {
  erc20TransferAbi,
  getTreasuryAddress,
  getUsdcTokenAddress,
  parseUsdcAmount,
} from "@/lib/usdc";

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

    const treasuryAddress = getTreasuryAddress();
    if (!treasuryAddress) {
      throw new Error("Set NEXT_PUBLIC_VERITY_TREASURY_ADDRESS in .env.local before paid USDC actions.");
    }

    const usdcAddress = getUsdcTokenAddress();
    if (!usdcAddress) {
      throw new Error("Arc USDC token address is not configured.");
    }

    const hash = await writeContractAsync({
      abi: erc20TransferAbi,
      address: usdcAddress,
      args: [treasuryAddress, parseUsdcAmount(amount)],
      chainId: arcTestnet.id,
      functionName: "transfer",
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, treasuryAddress };
  }

  return { transferToTreasury };
}
