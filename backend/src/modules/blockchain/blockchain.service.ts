import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPublicClient, http, PublicClient, defineChain } from "viem";
import fpmmAbi from "./abi/VerityFPMM.json";
import factoryAbi from "./abi/VerityMarketFactory.json";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Arc", symbol: "ARC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
});

@Injectable()
export class BlockchainService implements OnModuleInit {
  private publicClient: PublicClient;
  private fpmmAbi = fpmmAbi;
  private factoryAbi = factoryAbi;
  private usdcAbi: any;

  private fpmmAddress: `0x${string}`;
  private factoryAddress: `0x${string}`;
  private usdcAddress: `0x${string}`;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.configService.get<string>("ARC_RPC_URL") || "https://rpc.testnet.arc.network";
    this.fpmmAddress = this.configService.get<string>("FPMM_ADDRESS") as `0x${string}`;
    this.factoryAddress = this.configService.get<string>("FACTORY_ADDRESS") as `0x${string}`;
    this.usdcAddress = this.configService.get<string>("USDC_ADDRESS") as `0x${string}`;

    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(rpcUrl),
    }) as PublicClient;

    this.loadAbis();
  }

  private loadAbis() {
    // Standard ERC20 minimal ABI for USDC
    this.usdcAbi = [
      {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
      {
        type: "function",
        name: "allowance",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
      },
    ];
  }

  private formatMarketId(marketId: string): `0x${string}` {
    const clean = marketId.replace(/^0x/, "");
    return `0x${clean.padEnd(64, "0")}` as `0x${string}`;
  }

  async readPoolBalances(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getPoolBalances",
        args: [formattedMarketId],
      });
      const [yesBalance, noBalance, totalLPShares, totalDeposited, active, resolved] = result as [
        bigint,
        bigint,
        bigint,
        bigint,
        boolean,
        boolean,
      ];
      return {
        yesBalance,
        noBalance,
        totalLPShares,
        totalDeposited,
        active,
        resolved,
      };
    } catch (error) {
      throw new Error(`Failed to read pool balances for market ${marketId}: ${error.message}`);
    }
  }

  async readLPShares(marketId: string, userAddress: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "lpShares",
        args: [formattedMarketId, userAddress as `0x${string}`],
      });
      return result as bigint;
    } catch (error) {
      throw new Error(`Failed to read LP shares for market ${marketId}, user ${userAddress}: ${error.message}`);
    }
  }

  async getMarketPrices(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const yesPriceResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getYesPrice",
        args: [formattedMarketId],
      });

      const noPriceResult = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "getNoPrice",
        args: [formattedMarketId],
      });

      // Price is returned scaled by 1e18 on-chain. Convert to standard decimal representation (0 to 1)
      const yesPrice = Number(yesPriceResult as bigint) / 1e18;
      const noPrice = Number(noPriceResult as bigint) / 1e18;

      return { yesPrice, noPrice };
    } catch (error) {
      // If pool is not active or getYesPrice reverts, return 0.5/0.5 default price
      return { yesPrice: 0.5, noPrice: 0.5 };
    }
  }

  async getTransactionReceipt(txHash: `0x${string}`) {
    try {
      return await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    } catch (error) {
      throw new Error(`Transaction verification failed for hash ${txHash}: ${error.message}`);
    }
  }

  async readEscrowBalance(marketId: string) {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.factoryAddress,
        abi: this.factoryAbi,
        functionName: "escrowBalances",
        args: [formattedMarketId],
      });
      return result as bigint;
    } catch (error) {
      throw new Error(`Failed to read escrow balance for market ${marketId}: ${error.message}`);
    }
  }

  async canRemoveLiquidity(marketId: string, walletAddress: string): Promise<boolean> {
    const formattedMarketId = this.formatMarketId(marketId);
    try {
      const result = await this.publicClient.readContract({
        address: this.fpmmAddress,
        abi: this.fpmmAbi,
        functionName: "canRemoveLiquidity",
        args: [formattedMarketId, walletAddress as `0x${string}`],
      });
      return result as boolean;
    } catch (error) {
      return false;
    }
  }
}
