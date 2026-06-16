import { defineChain, http, createPublicClient } from "viem"
import type { Address } from "viem"

const chainId = Number(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID || "")
const rpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network"
const usdcAddress = process.env.NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS || ""

export const arcTestnet = defineChain({
  id: chainId,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Arc",
    symbol: "ARC",
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  testnet: true,
})

export const arcTransport = http(rpcUrl)

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: arcTransport,
})

export const arcUsdcAddress = usdcAddress as Address

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "") as Address
export const FPMM_ADDRESS = (process.env.NEXT_PUBLIC_FPMM_ADDRESS ||
  "") as Address
export const RESOLVER_ADDRESS = (process.env.NEXT_PUBLIC_RESOLVER_ADDRESS ||
  "") as Address
export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
  "") as Address

export function hasArcWalletConfig() {
  return Boolean(chainId && rpcUrl && usdcAddress)
}

export function shortAddress(address?: string) {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Consolidated Contract ABIs
export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

export const erc1155Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const

import {
  conditionalTokenVaultAbi as vaultAbi,
  verityFpmmAbi as fpmmAbi,
  verityMarketFactoryAbi as factoryAbi,
  verityOptimisticResolverAbi as resolverAbi,
} from "./contracts-generated"

export { vaultAbi, fpmmAbi, factoryAbi, resolverAbi }

export function formatWeb3Error(error: any): string {
  if (!error) return "Unknown error occurred."

  const message = String(error.message || error)
  const shortMessage = String(error.shortMessage || "")

  // 1. Check for user rejection / cancellation
  if (
    message.includes("User rejected") ||
    message.includes("User denied") ||
    shortMessage.includes("User rejected") ||
    shortMessage.includes("User denied")
  ) {
    return "Transaction was cancelled by user."
  }

  // 2. Check for revert reasons / specific ERC20 errors
  if (
    message.includes("transfer amount exceeds allowance") ||
    shortMessage.includes("transfer amount exceeds allowance")
  ) {
    return "USDC transfer exceeds allowance. Please approve the USDC transaction first."
  }
  if (
    message.includes("transfer amount exceeds balance") ||
    shortMessage.includes("transfer amount exceeds balance")
  ) {
    return "Insufficient USDC balance to complete this transaction."
  }
  if (
    message.includes("insufficient funds for gas") ||
    shortMessage.includes("insufficient funds for gas")
  ) {
    return "Insufficient funds for transaction gas."
  }

  // Fallback to shortMessage if available, otherwise a clean summary of message
  if (shortMessage) {
    return shortMessage
  }

  // If it's a long viem error message, try to extract the reason
  const match = message.match(/reverted with reason:\s*([^.\n]+)/)
  if (match && match[1]) {
    return `Execution reverted: ${match[1].trim()}`
  }

  return message.slice(0, 120)
}
