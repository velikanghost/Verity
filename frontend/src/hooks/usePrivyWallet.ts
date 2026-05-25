"use client";

import { useWallets } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";

export function usePrivyWallet() {
  const { client } = useSmartWallets();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const address = client?.account?.address;
  const isConnected = Boolean(client);

  // Safely extract the active chain ID from CAIP-2 string (e.g. "eip155:5042002")
  const chainId = embeddedWallet
    ? Number(embeddedWallet.chainId.split(":")[1])
    : undefined;

  const switchChain = async (targetChainId: number) => {
    if (!client) throw new Error("Wallet not connected");
    await client.switchChain({ id: targetChainId });
  };

  const sendBatchCalls = async (calls: { to: `0x${string}`; data: `0x${string}` }[]) => {
    if (!client) {
      throw new Error("Wallet client is not initialized yet. Please try again.");
    }
    
    // Privy's smart wallet client has a native, stable sendTransaction method 
    // that handles standard calls or an array of batch calls.
    const hash = await client.sendTransaction({
      calls: calls.map((c) => ({
        to: c.to,
        data: c.data,
      })),
    });
    return hash;
  };

  return {
    address,
    isConnected,
    chainId,
    walletClient: client,
    switchChain,
    sendBatchCalls,
  };
}
