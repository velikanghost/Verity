import { defineChain, http } from "viem";
import type { Address } from "viem";

const chainId = Number(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID || "5042002");
const rpcUrl = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
const usdcAddress = process.env.NEXT_PUBLIC_ARC_TESTNET_USDC_ADDRESS || "0x3600000000000000000000000000000000000000";

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
      http: [rpcUrl],
    },
  },
  testnet: true,
});

export const arcTransport = http(rpcUrl);

export const arcUsdcAddress = usdcAddress as Address;

export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "0x47248BfD909337F78De56Aaa82d070Eb8964F30F") as Address;
export const FPMM_ADDRESS = (process.env.NEXT_PUBLIC_FPMM_ADDRESS || "0x51203EF25B201A9138603d50711092698C350e24") as Address;
export const RESOLVER_ADDRESS = (process.env.NEXT_PUBLIC_RESOLVER_ADDRESS || "0x8D387a1704E7efb92b315e97db54DA92a6212A1b") as Address;
export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0x53B2404b703B78e0dfca79ffA0BDf7eBCb17E563") as Address;
export const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || "0xfd5b97972669Dbd447560B4c7b0eEbe7BD58ff3d") as Address;



export function hasArcWalletConfig() {
  return Boolean(chainId && rpcUrl && usdcAddress);
}

export function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
] as const;

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
] as const;

export const factoryAbi = [
  {
    name: "depositPreMarketLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "createMarketPreDeposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "creatorLpAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "claimRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const fpmmAbi = [
  {
    name: "addLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "removeLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "buy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "buyYes", type: "bool" },
      { name: "investmentAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sell",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "sellYes", type: "bool" },
      { name: "returnAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "claimCreatorLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [],
  },
] as const;

export const resolverAbi = [
  {
    name: "disputeResolution",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "resolutionBond",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "proposals",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "proposer", type: "address" },
      { name: "proposedWinningOutcome", type: "bool" },
      { name: "proposalTime", type: "uint256" },
      { name: "disputed", type: "bool" },
      { name: "disputer", type: "address" },
      { name: "finalized", type: "bool" },
    ],
  },
] as const;

export const vaultAbi = [
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [],
  },
] as const;

export const routerAbi = [
  {
    name: "createMarketPreDeposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "factory", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "creatorLpAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "depositPreMarketLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "factory", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "buy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fpmm", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "isYes", type: "bool" },
      { name: "usdcAmount", type: "uint256" },
    ],
    outputs: [{ name: "tokensOut", type: "uint256" }],
  },
  {
    name: "addLiquidity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fpmm", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "usdcAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "proposeResolution",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resolver", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "proposedOutcome", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "disputeResolution",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resolver", type: "address" },
      { name: "marketId", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

