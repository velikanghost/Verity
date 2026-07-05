import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { MarketTrade, MarketTradeDocument } from "./markets.model"
import { BlockchainService } from "../blockchain/blockchain.service"
import { NanopaymentsService } from "../circle-wallet/nanopayments.service"

import { ConfigService } from "@nestjs/config"

@Injectable()
export class RoyaltyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoyaltyService.name)
  private isProcessingQueue = false
  private intervalId: NodeJS.Timeout | null = null

  constructor(
    @InjectModel(MarketTrade.name)
    private readonly marketTradeModel: Model<MarketTradeDocument>,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
    private readonly nanopaymentsService: NanopaymentsService,
  ) {}

  onModuleInit() {
    const intervalMs =
      this.configService.get<number>("ROYALTY_QUEUE_INTERVAL_MS") || 120000
    this.logger.log(
      `Initializing Royalty Payout Queue Processor (interval: ${intervalMs}ms)...`,
    )
    this.intervalId = setInterval(() => {
      this.processPendingRoyaltiesQueue().catch((err) => {
        this.logger.error(
          `Error in royalty payout background process: ${err.message}`,
        )
      })
    }, intervalMs)
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  /**
   * Periodically scans the database for unpaid royalties, groups them by creator,
   * and executes batched on-chain transfers.
   */
  async processPendingRoyaltiesQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return
    }
    this.isProcessingQueue = true

    try {
      // Find all unpaid trades with positive feeUsdc
      const pendingTrades = await this.marketTradeModel
        .find({
          feeUsdc: { $gt: 0 },
          royaltyPaid: { $ne: true },
        })
        .sort({ createdAt: 1 })
        .limit(100) // Process in batches of 100 maximum per loop

      if (pendingTrades.length === 0) {
        return
      }

      this.logger.log(
        `Found ${pendingTrades.length} pending royalties to process.`,
      )

      // Group trades by marketId first to resolve their pool creator address once per market
      const tradesByMarket: Record<string, MarketTradeDocument[]> = {}
      for (const trade of pendingTrades) {
        const mId = trade.marketId.toString()
        if (!tradesByMarket[mId]) {
          tradesByMarket[mId] = []
        }
        tradesByMarket[mId].push(trade)
      }

      // Group royalty amounts and trades by creator address
      const tradesByCreator: Record<
        string,
        { trades: MarketTradeDocument[]; amount: number }
      > = {}

      for (const [marketId, trades] of Object.entries(tradesByMarket)) {
        try {
          const poolState = await this.blockchainService.getPoolState(marketId)
          const creatorAddress = poolState.creatorAddress

          if (
            !creatorAddress ||
            creatorAddress === "0x0000000000000000000000000000000000000000"
          ) {
            this.logger.warn(
              `No valid creator found for market ${marketId}. Marking trades as processed to avoid blocking.`,
            )
            for (const trade of trades) {
              trade.royaltyPaid = true
              trade.royaltyAmountUsdc = 0
              trade.royaltyPaidTxHash = "invalid_creator"
              trade.royaltyStatus = "settled"
              await trade.save()
            }
            continue
          }

          const creatorKey = creatorAddress.toLowerCase()
          if (!tradesByCreator[creatorKey]) {
            tradesByCreator[creatorKey] = { trades: [], amount: 0 }
          }

          for (const trade of trades) {
            // Royalty is 50% of the 40% platform fee = 20% of total feeUsdc
            const rAmt = Number((trade.feeUsdc * 0.4 * 0.5).toFixed(6))
            tradesByCreator[creatorKey].trades.push(trade)
            tradesByCreator[creatorKey].amount += rAmt
          }
        } catch (err: any) {
          this.logger.error(
            `Failed to fetch pool creator for market ${marketId}: ${err.message}`,
          )
          // We don't mark as paid, so we can retry on the next execution loop
        }
      }

      // Process payouts for each creator address sequentially to avoid nonce collisions
      const adminAddress = this.blockchainService
        .getAdminAddress()
        .toLowerCase()

      for (const [creatorAddress, data] of Object.entries(tradesByCreator)) {
        const totalAmount = Number(data.amount.toFixed(6))
        const tradesToUpdate = data.trades

        if (totalAmount <= 0) {
          // Zero-out the royalties (e.g. if amounts underflow)
          for (const trade of tradesToUpdate) {
            trade.royaltyPaid = true
            trade.royaltyAmountUsdc = 0
            trade.royaltyPaidTxHash = "zero_amount"
            trade.royaltyStatus = "settled"
            await trade.save()
          }
          continue
        }

        try {
          let txHash = "self_split"

          // Skip on-chain transfer if creator is the admin/treasury wallet
          if (creatorAddress !== adminAddress) {
            txHash = await this.nanopaymentsService.payoutUSDC(
              creatorAddress,
              totalAmount,
            )
            this.logger.log(
              `Paid batched creator royalty of ${totalAmount} USDC via Circle Gateway to ${creatorAddress} for ${tradesToUpdate.length} trades. Tx: ${txHash}`,
            )
          } else {
            this.logger.log(
              `Creator is admin/treasury for ${tradesToUpdate.length} trades. Skipping self-transfer.`,
            )
          }

          // Mark trades as paid in MongoDB
          for (const trade of tradesToUpdate) {
            const rAmt = Number((trade.feeUsdc * 0.4 * 0.5).toFixed(6))
            trade.royaltyPaid = true
            trade.royaltyPaidTxHash = txHash
            trade.royaltyAmountUsdc = rAmt
            trade.royaltyStatus = "settled"
            await trade.save()
          }
        } catch (error: any) {
          this.logger.error(
            `Failed to payout batch royalty to ${creatorAddress}: ${error.message}`,
          )
          // Do not mark trades as paid, they will be retried in the next cron run
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to process pending royalties queue: ${err.message}`,
      )
    } finally {
      this.isProcessingQueue = false
    }
  }
}
