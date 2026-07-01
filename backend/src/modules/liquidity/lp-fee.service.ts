import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import { MarketTrade } from "../markets/markets.model"
import { LPPosition, LPPositionDocument, LiquidityPool, LiquidityPoolDocument, LpFeeLedger, LpFeeLedgerDocument } from "./liquidity.model"
import { User, UserDocument } from "../users/users.model"
import { BlockchainService } from "../blockchain/blockchain.service"
import { ConfigService } from "@nestjs/config"

@Injectable()
export class LpFeeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LpFeeService.name)
  private isProcessingQueue = false
  private isProcessingPayouts = false
  private intervalId: NodeJS.Timeout | null = null

  constructor(
    @InjectModel(MarketTrade.name)
    private readonly marketTradeModel: Model<MarketTrade>,
    @InjectModel(LPPosition.name)
    private readonly lpPositionModel: Model<LPPositionDocument>,
    @InjectModel(LiquidityPool.name)
    private readonly liquidityPoolModel: Model<LiquidityPoolDocument>,
    @InjectModel(LpFeeLedger.name)
    private readonly lpFeeLedgerModel: Model<LpFeeLedgerDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const intervalMs =
      this.configService.get<number>("LP_FEE_PROCESSOR_INTERVAL_MS") || 120000 // 2 min default
    this.logger.log(
      `Initializing LP Fee Nanopayments Processor (interval: ${intervalMs}ms)...`,
    )
    this.intervalId = setInterval(() => {
      this.processPendingLpFees().catch((err) => {
        this.logger.error(`Error in LP fee background process: ${err.message}`)
      })
    }, intervalMs)
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  /**
   * Process all pending trades off-chain and apportion LP fees to the active LPs.
   */
  async processPendingLpFees(): Promise<void> {
    if (this.isProcessingQueue) {
      return
    }
    this.isProcessingQueue = true

    try {
      // Find all unpaid trades with positive feeUsdc
      const pendingTrades = await this.marketTradeModel
        .find({
          feeUsdc: { $gt: 0 },
          lpFeesPending: true,
        })
        .sort({ createdAt: 1 })
        .limit(100) // process in batches of 100

      if (pendingTrades.length === 0) {
        this.isProcessingQueue = false
        // Run auto-push check even if no new trades were processed
        await this.processAutoPushPayouts()
        return
      }

      this.logger.log(
        `Found ${pendingTrades.length} pending trades to process for LP fees.`,
      )

      // Group trades by marketId
      const tradesByMarket: Record<string, MarketTrade[]> = {}
      for (const trade of pendingTrades) {
        const mId = trade.marketId.toString()
        if (!tradesByMarket[mId]) {
          tradesByMarket[mId] = []
        }
        tradesByMarket[mId].push(trade)
      }

      for (const [marketId, trades] of Object.entries(tradesByMarket)) {
        try {
          const pool = await this.liquidityPoolModel.findOne({
            marketId: new Types.ObjectId(marketId),
          })

          if (!pool || pool.totalLPShares <= 0) {
            this.logger.warn(
              `No active LP pool found for market ${marketId}. Marking trades as processed to avoid block.`,
            )
            for (const trade of trades) {
              trade.lpFeesPending = false
              trade.lpFeesPaid = true
              trade.lpFeesPaidTxHash = "no_pool"
              await (trade as any).save()
            }
            continue
          }

          // Fetch active positions
          const positions = await this.lpPositionModel.find({
            poolId: pool._id,
            lpShares: { $gt: 0 },
          })

          if (positions.length === 0) {
            this.logger.warn(
              `No active LPs holding shares found for pool ${pool._id}. Marking trades as processed.`,
            )
            for (const trade of trades) {
              trade.lpFeesPending = false
              trade.lpFeesPaid = true
              trade.lpFeesPaidTxHash = "no_positions"
              await (trade as any).save()
            }
            continue
          }

          // Calculate total fee allocated to LPs (60% of total feeUsdc)
          const totalLpFees = trades.reduce(
            (sum, t) => sum + t.feeUsdc * 0.6,
            0,
          )

          // Apportion to each active LP
          for (const pos of positions) {
            const ratio = pos.lpShares / pool.totalLPShares
            const earned = Number((totalLpFees * ratio).toFixed(6))

            if (earned > 0) {
              await this.lpFeeLedgerModel.findOneAndUpdate(
                { walletAddress: pos.walletAddress.toLowerCase() },
                {
                  $inc: { accruedFeesUsdc: earned },
                  $setOnInsert: { userId: pos.userId },
                },
                { upsert: true, new: true },
              )
            }
          }

          // Mark trades as processed
          for (const trade of trades) {
            trade.lpFeesPending = false
            trade.lpFeesPaid = true
            trade.lpFeesPaidTxHash = "apportioned"
            await (trade as any).save()
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to apportion LP fees for market ${marketId}: ${err.message}`,
          )
        }
      }
    } catch (err: any) {
      this.logger.error(`Error processing pending LP fees: ${err.message}`)
    } finally {
      this.isProcessingQueue = false
    }

    // Run auto-push payouts checks
    await this.processAutoPushPayouts()
  }

  /**
   * Periodically push payouts to users whose accrued fees exceed the threshold (Option A).
   */
  async processAutoPushPayouts(): Promise<void> {
    if (this.isProcessingPayouts) {
      return
    }
    this.isProcessingPayouts = true

    try {
      const threshold =
        this.configService.get<number>("LP_FEE_AUTOPUSH_THRESHOLD_USDC") || 1.0 // 1 USDC threshold

      const payableUsers = await this.lpFeeLedgerModel.find({
        accruedFeesUsdc: { $gte: threshold },
      })

      if (payableUsers.length === 0) {
        return
      }

      this.logger.log(
        `Found ${payableUsers.length} LPs eligible for auto-push payout (threshold: ${threshold} USDC).`,
      )

      const adminAddress = this.blockchainService
        .getAdminAddress()
        .toLowerCase()

      for (const ledger of payableUsers) {
        const amount = Number(ledger.accruedFeesUsdc.toFixed(6))
        try {
          let txHash = "self_split"

          if (ledger.walletAddress.toLowerCase() !== adminAddress) {
            txHash = await this.blockchainService.transferUsdcFromTreasury(
              ledger.walletAddress,
              amount,
            )
            this.logger.log(
              `Auto-pushed LP fee payout of ${amount} USDC to ${ledger.walletAddress}. Tx: ${txHash}`,
            )
          } else {
            this.logger.log(
              `LPs includes admin/treasury wallet. Skipping self-transfer of ${amount} USDC.`,
            )
          }

          ledger.totalPaidFeesUsdc += ledger.accruedFeesUsdc
          ledger.accruedFeesUsdc = 0
          ledger.lastPayoutTxHash = txHash
          await ledger.save()
        } catch (err: any) {
          this.logger.error(
            `Failed to auto-push LP fee payout to ${ledger.walletAddress}: ${err.message}`,
          )
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in auto-pushing LP fee payouts: ${err.message}`)
    } finally {
      this.isProcessingPayouts = false
    }
  }

  /**
   * Execute manual claim of accrued LP fees for a specific user.
   */
  async claimAccruedFees(userId: string): Promise<{ txHash: string; amountClaimed: number }> {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException("User not found.")
    }

    if (!user.walletAddress) {
      throw new BadRequestException("User profile does not contain a wallet address.")
    }

    const ledger = await this.lpFeeLedgerModel.findOne({
      walletAddress: user.walletAddress.toLowerCase(),
    })

    if (!ledger || ledger.accruedFeesUsdc <= 0) {
      throw new BadRequestException("You have no accrued LP fees to claim.")
    }

    const amount = Number(ledger.accruedFeesUsdc.toFixed(6))
    const adminAddress = this.blockchainService.getAdminAddress().toLowerCase()

    try {
      let txHash = "self_split"

      if (user.walletAddress.toLowerCase() !== adminAddress) {
        txHash = await this.blockchainService.transferUsdcFromTreasury(
          user.walletAddress,
          amount,
        )
        this.logger.log(
          `User ${user.username} claimed LP fee payout of ${amount} USDC to ${user.walletAddress}. Tx: ${txHash}`,
        )
      } else {
        this.logger.log(
          `User is admin/treasury. Skipping self-transfer of ${amount} USDC.`,
        )
      }

      ledger.totalPaidFeesUsdc += ledger.accruedFeesUsdc
      ledger.accruedFeesUsdc = 0
      ledger.lastPayoutTxHash = txHash
      await ledger.save()

      return {
        txHash,
        amountClaimed: amount,
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to claim LP fee payout for ${user.walletAddress}: ${err.message}`,
      )
      throw new BadRequestException(`Claim transaction failed: ${err.message}`)
    }
  }

  /**
   * Retrieves the accrued fee information for a user.
   */
  async getAccruedFees(userId: string): Promise<{ accruedFeesUsdc: number; totalPaidFeesUsdc: number }> {
    const user = await this.userModel.findById(userId)
    if (!user) {
      throw new NotFoundException("User not found.")
    }

    if (!user.walletAddress) {
      return { accruedFeesUsdc: 0, totalPaidFeesUsdc: 0 }
    }

    const ledger = await this.lpFeeLedgerModel.findOne({
      walletAddress: user.walletAddress.toLowerCase(),
    })

    return {
      accruedFeesUsdc: ledger?.accruedFeesUsdc || 0,
      totalPaidFeesUsdc: ledger?.totalPaidFeesUsdc || 0,
    }
  }
}
