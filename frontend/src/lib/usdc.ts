import { isAddress, parseUnits, type Address } from "viem";
import { arcUsdcAddress } from "@/lib/arc";

export const USDC_DECIMALS = 6;

export const erc20TransferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function getTreasuryAddress() {
  const address = process.env.NEXT_PUBLIC_VERITY_TREASURY_ADDRESS;
  if (!address || !isAddress(address)) return null;
  return address as Address;
}

export function getUsdcTokenAddress() {
  if (!isAddress(arcUsdcAddress)) return null;
  return arcUsdcAddress as Address;
}

export function parseUsdcAmount(amount: number) {
  return parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
}
