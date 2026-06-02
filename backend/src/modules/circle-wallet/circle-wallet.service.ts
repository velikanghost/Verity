import {
  Injectable,
  OnModuleInit,
  Logger,
  BadRequestException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/users.model"
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets"
import { encodeFunctionData, parseAbi, createPublicClient, http } from "viem"
import { randomUUID } from "crypto"

@Injectable()
export class CircleWalletService implements OnModuleInit {
  private readonly logger = new Logger(CircleWalletService.name)
  private client: any

  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>("CIRCLE_API_KEY")
    const entitySecret = this.configService.get<string>("CIRCLE_ENTITY_SECRET")

    if (!apiKey || !entitySecret) {
      this.logger.warn(
        "Circle Wallet Service: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET is not configured.",
      )
      return
    }

    try {
      this.client = initiateDeveloperControlledWalletsClient({
        apiKey,
        entitySecret,
      })
      this.logger.log(
        "Circle WaaS Developer Controlled Wallets Client initialized successfully.",
      )
    } catch (error) {
      this.logger.error("Failed to initialize Circle WaaS client:", error)
    }
  }

  async createWalletForUser(userId: string): Promise<string> {
    if (!this.client) {
      throw new BadRequestException("Circle WaaS Client is not initialized.")
    }

    const walletSetId = this.configService.get<string>("CIRCLE_WALLET_SET_ID")
    if (!walletSetId) {
      throw new BadRequestException(
        "CIRCLE_WALLET_SET_ID is not configured in .env",
      )
    }

    try {
      const blockchain =
        this.configService.get<string>("CIRCLE_BLOCKCHAIN") || "ARC-TESTNET"
      this.logger.log(
        `Requesting Circle WaaS SCA Wallet on ${blockchain} for user: ${userId}`,
      )
      const response = await this.client.createWallets({
        walletSetId,
        blockchains: [blockchain as any],
        accountType: "SCA",
        count: 1,
      })

      const wallet = response.data.wallets?.[0]
      if (!wallet) {
        throw new Error("No wallet was returned by Circle WaaS API.")
      }

      this.logger.log(
        `SCA Wallet created successfully: ${wallet.address} (ID: ${wallet.id})`,
      )

      // Save details to the User document
      await this.userModel.findByIdAndUpdate(userId, {
        walletAddress: wallet.address.toLowerCase(),
        circleWalletId: wallet.id,
      })

      return wallet.address
    } catch (error) {
      this.logger.error(
        `Failed to create Circle wallet for user ${userId}:`,
        error.response?.data || error.message,
      )
      throw new BadRequestException(
        `Circle wallet creation failed: ${error.response?.data?.message || error.message}`,
      )
    }
  }

  async executeContractCall(
    circleWalletId: string,
    contractAddress: string,
    abiFunctionSignature: string,
    abiParameters: any[],
    idempotencyKey: string,
  ): Promise<string> {
    if (!this.client) {
      throw new BadRequestException("Circle WaaS Client is not initialized.")
    }

    try {
      this.logger.log(
        `Executing contract call to ${contractAddress} [${abiFunctionSignature}] with parameters: ${JSON.stringify(abiParameters)}`,
      )
      const response = await this.client.createContractExecutionTransaction({
        walletId: circleWalletId,
        contractAddress,
        abiFunctionSignature,
        abiParameters,
        fee: {
          type: "level",
          config: {
            feeLevel: "MEDIUM",
          },
        },
        idempotencyKey,
      })

      const transactionId = response.data?.id || response.data?.transaction?.id
      if (!transactionId) {
        throw new Error("No transaction ID returned from Circle WaaS.")
      }

      // Wait/poll for transaction completion
      const txHash = await this.pollTransactionReceipt(transactionId)
      return txHash
    } catch (error) {
      const details = error.response?.data
        ? JSON.stringify(error.response.data, null, 2)
        : error.message || error
      this.logger.error(`Contract execution transaction failed: ${details}`)
      throw new BadRequestException(
        `Contract execution failed: ${error.message || error}`,
      )
    }
  }

  async executeBatch(
    userId: string,
    calls: Array<{
      contractAddress: string
      abiFunctionSignature: string
      abiParameters: any[]
    }>,
    estimatedCostUsdc?: number,
  ): Promise<string> {
    const user = await this.userModel.findById(userId)
    if (!user || !user.circleWalletId || !user.walletAddress) {
      throw new BadRequestException(
        "User does not have an active Circle Developer-Controlled Wallet.",
      )
    }

    if (calls.length === 0) {
      throw new BadRequestException("Cannot execute empty transaction batch.")
    }

    this.logger.log(
      `Starting execution of batch with ${calls.length} calls for user ${userId}`,
    )
    this.logger.log(`Raw calls: ${JSON.stringify(calls, null, 2)}`)

    // Initialize public client to perform on-chain balance checks
    const rpcUrl =
      this.configService.get<string>("ARC_RPC_URL") ||
      "https://rpc.testnet.arc.network"
    const usdcAddress =
      this.configService.get<string>("USDC_ADDRESS") ||
      "0x3600000000000000000000000000000000000000"

    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    })

    // 1. Validate native ARC balance (gas)
    try {
      const nativeBalance = await publicClient.getBalance({
        address: user.walletAddress as `0x${string}`,
      })
      if (nativeBalance === 0n) {
        throw new BadRequestException(
          "Insufficient native ARC tokens for gas. Please request ARC from the faucet.",
        )
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err
      this.logger.warn(`Failed to check native ARC balance: ${err.message}`)
    }

    // 2. Validate USDC balance if estimatedCostUsdc is provided
    if (estimatedCostUsdc && estimatedCostUsdc > 0) {
      try {
        const usdcBalance = await publicClient.readContract({
          address: usdcAddress as `0x${string}`,
          abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
          functionName: "balanceOf",
          args: [user.walletAddress as `0x${string}`],
        })

        const requiredUsdcRaw = BigInt(Math.round(estimatedCostUsdc * 1e6))
        if (usdcBalance < requiredUsdcRaw) {
          const currentUsdc = Number(usdcBalance) / 1e6
          throw new BadRequestException(
            `Insufficient USDC balance. This transaction requires ${estimatedCostUsdc} USDC, but your wallet only has ${currentUsdc} USDC.`,
          )
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err
        this.logger.warn(`Failed to check USDC balance: ${err.message}`)
      }
    }

    if (calls.length === 1) {
      const call = calls[0]
      const idempotencyKey = randomUUID()
      return this.executeContractCall(
        user.circleWalletId,
        call.contractAddress,
        call.abiFunctionSignature,
        call.abiParameters,
        idempotencyKey,
      )
    }

    // Parse and encode multiple calls into the executeBatch structure of the user's SCA wallet
    const encodedCalls = calls.map((call) => {
      const rawSig = call.abiFunctionSignature.trim()
      const signature = rawSig.startsWith("function ")
        ? rawSig
        : `function ${rawSig}`
      const abi = parseAbi([signature] as any)
      const functionName = rawSig.split("(")[0].replace("function ", "").trim()

      const calldata = encodeFunctionData({
        abi,
        functionName,
        args: call.abiParameters,
      } as any)

      return [
        call.contractAddress,
        "0", // value: 0 native token
        calldata,
      ]
    })

    this.logger.log(
      `Encoded calls for batch: ${JSON.stringify(encodedCalls, null, 2)}`,
    )

    const idempotencyKey = randomUUID()
    const txHash = await this.executeContractCall(
      user.circleWalletId,
      user.walletAddress, // SCA wallet address itself receives the executeBatch call
      "executeBatch((address, uint256, bytes)[])",
      [encodedCalls],
      idempotencyKey,
    )

    return txHash
  }

  private async pollTransactionReceipt(transactionId: string): Promise<string> {
    const maxAttempts = 30 // 30 attempts, 2 seconds apart = 60 seconds max
    const intervalMs = 2000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))

      try {
        const response = await this.client.getTransaction({ id: transactionId })
        const tx = response.data?.transaction
        const state = tx?.state || response.data?.state

        this.logger.debug(
          `Polling transaction ${transactionId} state: ${state} (Attempt ${attempt}/${maxAttempts})`,
        )

        if (state === "COMPLETE" || state === "CONFIRMED") {
          const txHash = tx?.txHash || response.data?.txHash
          if (!txHash) {
            throw new Error(
              "Transaction state is complete but no on-chain txHash was found.",
            )
          }
          return txHash
        }

        if (state === "FAILED" || state === "CANCELLED") {
          throw new Error(`Transaction state ended in failure state: ${state}`)
        }
      } catch (error) {
        if (error.message.includes("ended in failure state")) {
          throw error
        }
        this.logger.warn(
          `Error polling transaction ${transactionId}: ${error.message}`,
        )
      }
    }

    throw new Error(
      `Transaction ${transactionId} did not reach complete state within 60 seconds.`,
    )
  }
}
