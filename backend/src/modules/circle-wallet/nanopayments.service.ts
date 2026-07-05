import { Injectable, OnModuleInit, Logger, BadRequestException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GatewayClient } from "@circle-fin/x402-batching/client"

@Injectable()
export class NanopaymentsService implements OnModuleInit {
  private readonly logger = new Logger(NanopaymentsService.name)
  private client: GatewayClient | null = null

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const rawPrivateKey =
      this.configService.get<string>("ADMIN_PRIVATE_KEY") ||
      this.configService.get<string>("KEEPER_PRIVATE_KEY")

    if (!rawPrivateKey) {
      this.logger.warn("Nanopayments Service: ADMIN_PRIVATE_KEY or KEEPER_PRIVATE_KEY is not configured.")
      return
    }

    const privateKey = (
      rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`
    ) as `0x${string}`

    const blockchainEnv = this.configService.get<string>("CIRCLE_BLOCKCHAIN") || "ARC-TESTNET"
    // Map blockchain env name to SupportedChainName expected by GatewayClient
    let chain: "arcTestnet" | "arc" | "baseSepolia" | "base" = "arcTestnet"
    const lowerEnv = blockchainEnv.toLowerCase()
    if (lowerEnv === "arc-testnet" || lowerEnv === "arctestnet") {
      chain = "arcTestnet"
    } else if (lowerEnv === "arc") {
      chain = "arc"
    } else if (lowerEnv === "base-sepolia" || lowerEnv === "basesepolia") {
      chain = "baseSepolia"
    } else if (lowerEnv === "base") {
      chain = "base"
    }

    const rpcUrl = this.configService.get<string>("ARC_RPC_URL")

    try {
      this.client = new GatewayClient({
        chain,
        privateKey,
        rpcUrl,
        arcPrivateMainnet: chain === "arc",
      })
      this.logger.log(`Circle GatewayClient initialized successfully on chain: ${chain}`)
    } catch (error: any) {
      this.logger.error("Failed to initialize Circle GatewayClient:", error)
    }
  }

  async payoutUSDC(recipientAddress: string, amountUsdc: number): Promise<string> {
    if (!this.client) {
      throw new BadRequestException("Circle GatewayClient is not initialized.")
    }

    if (amountUsdc <= 0) {
      throw new BadRequestException("Payout amount must be greater than zero.")
    }

    try {
      // 1. Fetch current balances to see if Gateway has sufficient funds
      this.logger.log(`Checking balance for Circle Gateway client...`)
      const balances = await this.client.getBalances()
      
      const availableGatewayUsdc = Number(balances.gateway.available) / 1e6
      this.logger.log(`Circle Gateway balance: ${availableGatewayUsdc} USDC (Available), Wallet balance: ${Number(balances.wallet.balance) / 1e6} USDC`)

      // 2. If Gateway balance is insufficient, check if wallet balance can cover it and deposit
      if (availableGatewayUsdc < amountUsdc) {
        const needed = amountUsdc - availableGatewayUsdc
        const walletUsdc = Number(balances.wallet.balance) / 1e6

        if (walletUsdc < needed) {
          throw new BadRequestException(
            `Insufficient total Treasury balance. Gateway has ${availableGatewayUsdc} USDC, Wallet has ${walletUsdc} USDC, but need ${amountUsdc} USDC total.`,
          )
        }

        // Deposit needed amount, or a standard 10 USDC top-up to avoid repetitive small deposits
        const depositAmount = Math.max(needed, 10.0)
        this.logger.log(`Depositing ${depositAmount} USDC from Treasury wallet to Circle Gateway...`)
        const depResult = await this.client.deposit(depositAmount.toFixed(6))
        this.logger.log(`USDC Deposit transaction submitted: ${depResult.depositTxHash}. Waiting 3 seconds...`)
        // Give the gateway contract a few seconds to register the deposit
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }

      this.logger.log(`Executing off-chain Circle Gateway withdrawal of ${amountUsdc} USDC to ${recipientAddress}`)
      const res = await this.client.withdraw(amountUsdc.toFixed(6), {
        recipient: recipientAddress as `0x${string}`,
      })
      this.logger.log(`Circle Gateway payout complete. Mint TX hash: ${res.mintTxHash}`)
      return res.mintTxHash
    } catch (error: any) {
      this.logger.error(
        `Failed to process Circle Gateway payout to ${recipientAddress}: ${error.message || error}`,
      )
      throw new BadRequestException(`Circle Gateway payout failed: ${error.message || error}`)
    }
  }
}
