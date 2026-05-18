import { defineChain, http } from "viem";
import type { Address } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID || "0");
const rpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "";
const usdcAddress = process.env.NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS || "";

export const arcTestnet = defineChain({
  id: chainId,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Arc Testnet Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [rpcUrl || "http://localhost:8545"],
    },
  },
  testnet: true,
});

export const arcTransport = http(rpcUrl || undefined);

export const arcUsdcAddress = usdcAddress as Address;

export function hasArcWalletConfig() {
  return Boolean(chainId && rpcUrl && usdcAddress);
}

export function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
