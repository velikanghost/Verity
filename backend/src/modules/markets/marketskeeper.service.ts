import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { Market, MarketDocument } from "./markets.model"
import { User, UserDocument } from "../users/users.model"
import { BlockchainService } from "../blockchain/blockchain.service"
import { AgentService } from "../agent/agent.service"
import { SocketGateway } from "../socket/socket.gateway"
import { ConfigService } from "@nestjs/config"
import { PvpService } from "../pvp/pvp.service"

@Injectable()
export class MarketsKeeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketsKeeperService.name)
  private intervalId: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor(
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly blockchainService: BlockchainService,
    private readonly agentService: AgentService,
    private readonly configService: ConfigService,
    private readonly socketGateway: SocketGateway,
    private readonly pvpService: PvpService,
  ) {}

  onModuleInit() {
    this.logger.log("Initializing Market Resolution Keeper...")
    // Run the keeper loop every 30 seconds
    this.intervalId = setInterval(() => this.processExpiredMarkets(), 30000)
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  async processExpiredMarkets() {
    if (this.isProcessing) {
      return
    }
    this.isProcessing = true

    try {
      await this.promoteQualifiedMarkets()
      await this.processPythMarkets()
      await this.processSubjectiveMarkets()
    } catch (error) {
      this.logger.error(`Error in keeper loop: ${error.message}`)
    } finally {
      this.isProcessing = false
    }
  }

  async promoteQualifiedMarkets() {
    const qualifiedMarkets = await this.marketModel.find({
      status: "qualified",
    })
    for (const market of qualifiedMarkets) {
      try {
        const marketIdStr = market._id.toString()
        const escrowBalanceBig =
          await this.blockchainService.readEscrowBalance(marketIdStr)
        const escrowBalance = Number(escrowBalanceBig) / 1e6

        if (escrowBalance >= market.minimumPoolBalance) {
          this.logger.log(
            `Qualified market ${marketIdStr} has reached ${escrowBalance} USDC LP. Automatically promoting to on-chain trading...`,
          )

          const creator = await this.userModel.findById(market.authorId)
          if (!creator || !creator.walletAddress) {
            this.logger.error(
              `Creator for market ${marketIdStr} has no linked wallet.`,
            )
            continue
          }

          const now = new Date()
          const sevenDaysFromNow = new Date(
            now.getTime() + 7 * 24 * 60 * 60 * 1000,
          )
          const fundingDeadline =
            market.deadline < sevenDaysFromNow
              ? market.deadline
              : sevenDaysFromNow

          const deadlineUnix = Math.floor(market.deadline.getTime() / 1000)
          const fundingDeadlineUnix = Math.floor(
            fundingDeadline.getTime() / 1000,
          )

          if (
            market.isPythMarket &&
            market.priceFeedId &&
            market.targetPrice != null
          ) {
            await this.blockchainService.registerPythMarket(
              marketIdStr,
              creator.walletAddress,
              deadlineUnix,
              fundingDeadlineUnix,
              market.priceFeedId,
              market.targetPrice,
              market.resolveAbove ?? true,
            )
          } else {
            await this.blockchainService.registerMarket(
              marketIdStr,
              creator.walletAddress,
              deadlineUnix,
              fundingDeadlineUnix,
            )
          }

          // Since 40 USDC escrow balance was already present, the contract automatically deployed the pool!
          // So we transition status to tradable directly
          market.status = "tradable"
          market.fundingDeadline = fundingDeadline
          await market.save()

          this.logger.log(
            `Market ${marketIdStr} successfully promoted to tradable.`,
          )

          // Emit Socket events to update UI in real-time
          this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
          this.socketGateway.broadcastToRoom(
            `market:${marketIdStr}`,
            "market-updated",
            {
              marketId: marketIdStr,
            },
          )
          this.socketGateway.broadcastToRoom(
            `post:${market.postId}`,
            "post-updated",
            { postId: market.postId.toString() },
          )
        }
      } catch (error) {
        this.logger.error(
          `Failed to promote market ${market._id}: ${error.message}`,
        )
      }
    }
  }

  async processPythMarkets() {
    const delayCutoff = new Date(Date.now() - 30000) // 30-second delay for Pyth VAA publishing indexer
    // Find unresolved Pyth markets that have passed their deadline plus the delay cutoff
    const expiredMarkets = await this.marketModel.find({
      isPythMarket: true,
      status: { $in: ["funding_pool", "tradable"] },
      deadline: { $lte: delayCutoff },
    })

    if (expiredMarkets.length > 0) {
      let blockTimestamp: number | null = null
      try {
        blockTimestamp = await this.blockchainService.getCurrentBlockTimestamp()
      } catch (err) {
        this.logger.warn(
          `Could not fetch block timestamp for Pyth resolution checks: ${err.message}`,
        )
      }

      this.logger.log(
        `Found ${expiredMarkets.length} expired Pyth markets to resolve.`,
      )

      for (const market of expiredMarkets) {
        if (blockTimestamp !== null) {
          const deadlineUnix = Math.floor(market.deadline.getTime() / 1000)
          if (blockTimestamp <= deadlineUnix) {
            this.logger.log(
              `Skipping Pyth market ${market._id} because on-chain block.timestamp (${blockTimestamp}) has not yet passed market deadline (${deadlineUnix}).`,
            )
            continue
          }
        }

        try {
          await this.resolveMarket(market)
        } catch (error) {
          this.logger.error(
            `Failed to auto-resolve market ${market._id}: ${error.message}`,
          )
        }
      }
    }
  }

  async processSubjectiveMarkets() {
    const now = new Date()
    // Find unresolved non-Pyth markets that have passed their deadline
    const expiredMarkets = await this.marketModel.find({
      isPythMarket: { $ne: true },
      status: { $in: ["funding_pool", "tradable", "resolving"] },
      deadline: { $lte: now },
    })

    if (expiredMarkets.length > 0) {
      let blockTimestamp: number | null = null
      try {
        blockTimestamp = await this.blockchainService.getCurrentBlockTimestamp()
      } catch (err) {
        this.logger.warn(
          `Could not fetch block timestamp for subjective resolution checks: ${err.message}`,
        )
      }

      this.logger.log(
        `Found ${expiredMarkets.length} expired subjective markets for AI resolution.`,
      )

      for (const market of expiredMarkets) {
        try {
          const marketIdStr = market._id.toString()
          const proposal =
            await this.blockchainService.readProposal(marketIdStr)

          if (
            proposal.proposer === "0x0000000000000000000000000000000000000000"
          ) {
            if (blockTimestamp !== null) {
              const deadlineUnix = Math.floor(market.deadline.getTime() / 1000)
              if (blockTimestamp <= deadlineUnix) {
                this.logger.log(
                  `Skipping proposing resolution for market ${marketIdStr} because on-chain block.timestamp (${blockTimestamp}) has not yet passed market deadline (${deadlineUnix}).`,
                )
                continue
              }
            }

            // No proposal yet -> AI agent investigates and proposes
            this.logger.log(
              `No active proposal found for market ${marketIdStr}. Invoking AI Agent...`,
            )

            const result = await this.agentService.resolveMarket(
              market.question,
              market.yesCondition,
              market.noCondition,
              market.resolutionSource,
            )

            if (result.outcome === "INVALID") {
              this.logger.warn(
                `AI Agent resolved market ${marketIdStr} as INVALID. Skipping automated proposal (requires manual intervention).`,
              )
              continue
            }

            const proposedOutcomeBool = result.outcome === "YES"
            this.logger.log(
              `AI Agent proposed outcome: ${result.outcome}. Submitting proposeResolution transaction...`,
            )

            const txHash = await this.blockchainService.proposeResolution(
              marketIdStr,
              proposedOutcomeBool,
            )
            await this.blockchainService.getTransactionReceipt(
              txHash as `0x${string}`,
            )

            // Save proposal info to DB
            market.proposalReasoning = result.reasoning
            market.proposalCitations = result.citations
            market.proposedOutcome = proposedOutcomeBool
            market.proposalProposer = "0xKeeper" // Mark keeper as proposer
            market.status = "resolving"
            await market.save()

            this.logger.log(
              `Successfully proposed resolution for market ${marketIdStr} (Outcome: ${result.outcome})`,
            )

            // Emit Socket events
            this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
            this.socketGateway.broadcastToRoom(
              `market:${marketIdStr}`,
              "market-updated",
              {
                marketId: marketIdStr,
              },
            )
          } else {
            // Proposal already exists -> check if disputed or finalized
            if (proposal.finalized) {
              // Already finalized on-chain -> sync with DB if needed
              if (market.status !== "resolved") {
                const onChainState =
                  await this.blockchainService.readOnChainMarketState(
                    marketIdStr,
                  )
                market.status = "resolved"
                market.resolvedOutcome = onChainState.winningIsYes
                  ? "YES"
                  : "NO"
                market.resolvedByAdmin = "0xKeeper"
                await market.save()
                await this.pvpService.resolvePvpMatchesForMarket(marketIdStr, market.resolvedOutcome)
                this.logger.log(
                  `Synced finalized market ${marketIdStr} in database.`,
                )

                // Emit Socket events
                this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
                this.socketGateway.broadcastToRoom(
                  `market:${marketIdStr}`,
                  "market-updated",
                  {
                    marketId: marketIdStr,
                  },
                )
              }
            } else if (proposal.disputed) {
              // Disputed but not finalized -> mark as disputed in DB
              if (!market.disputed) {
                market.disputed = true
                market.proposalDisputer = proposal.disputer
                market.status = "resolving"
                await market.save()
                this.logger.log(
                  `Market ${marketIdStr} flagged as DISPUTED in database.`,
                )

                // Emit Socket events
                this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
                this.socketGateway.broadcastToRoom(
                  `market:${marketIdStr}`,
                  "market-updated",
                  {
                    marketId: marketIdStr,
                  },
                )
              }
            } else {
              // Active proposal, undisputed -> check if dispute window has expired
              let disputeWindowExpired = false
              const disputeWindowSeconds = Number(
                this.configService.get<number>("DISPUTE_WINDOW_SECONDS") || 120,
              )

              if (blockTimestamp !== null) {
                disputeWindowExpired =
                  blockTimestamp >
                  Number(proposal.proposalTime) + disputeWindowSeconds
              } else {
                const elapsed =
                  Math.floor(Date.now() / 1000) - Number(proposal.proposalTime)
                disputeWindowExpired = elapsed > disputeWindowSeconds
              }

              if (disputeWindowExpired) {
                this.logger.log(
                  `Dispute window for market ${marketIdStr} has elapsed. Finalizing resolution...`,
                )
                const txHash =
                  await this.blockchainService.finalizeResolution(marketIdStr)
                await this.blockchainService.getTransactionReceipt(
                  txHash as `0x${string}`,
                )

                market.status = "resolved"
                market.resolvedOutcome = proposal.proposedWinningOutcome
                  ? "YES"
                  : "NO"
                market.resolvedByAdmin = "0xKeeper"
                await market.save()
                await this.pvpService.resolvePvpMatchesForMarket(marketIdStr, market.resolvedOutcome)

                this.logger.log(
                  `Successfully finalized resolution for market ${marketIdStr}.`,
                )

                // Emit Socket events
                this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
                this.socketGateway.broadcastToRoom(
                  `market:${marketIdStr}`,
                  "market-updated",
                  {
                    marketId: marketIdStr,
                  },
                )
              }
            }
          }
        } catch (error) {
          this.logger.error(
            `Error processing subjective market ${market._id}: ${error.message}`,
          )
        }
      }
    }
  }

  private async resolveMarket(market: MarketDocument) {
    // 0. Defense check: is it already resolved on-chain?
    const onChainStateBefore =
      await this.blockchainService.readOnChainMarketState(market._id.toString())
    if (onChainStateBefore.resolved) {
      this.logger.log(
        `Market ${market._id} is already resolved on-chain. Syncing database state...`,
      )
      const winningOutcome = onChainStateBefore.winningIsYes ? "YES" : "NO"
      market.status = "resolved"
      market.resolvedOutcome = winningOutcome
      market.resolvedByAdmin = "0xKeeper"
      await market.save()
      await this.pvpService.resolvePvpMatchesForMarket(market._id.toString(), winningOutcome)

      // Emit Socket events
      this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
      this.socketGateway.broadcastToRoom(
        `market:${market._id.toString()}`,
        "market-updated",
        {
          marketId: market._id.toString(),
        },
      )
      return
    }

    this.logger.log(
      `Auto-resolving Pyth market ${market._id} (${market.question})...`,
    )

    // 1. Fetch price update VAA from Pyth Benchmarks API
    const timestamp = Math.floor(market.deadline.getTime() / 1000)
    const feedId = market.priceFeedId || ""
    if (!feedId) {
      throw new Error(
        `Market ${market._id} is marked as Pyth market but has no priceFeedId.`,
      )
    }
    const cleanFeedId = feedId.startsWith("0x") ? feedId.slice(2) : feedId
    const url = `https://benchmarks.pyth.network/v1/updates/price/${timestamp}?ids=${cleanFeedId}`

    this.logger.log(`Fetching historical VAA from Benchmarks API: ${url}`)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Benchmarks API returned status ${response.status}: ${await response.text()}`,
      )
    }

    const data = (await response.json()) as { binary?: { data?: string[] } }
    const priceUpdate = data.binary?.data
    if (!priceUpdate || priceUpdate.length === 0) {
      throw new Error(
        "No price update binary found in Benchmarks API response.",
      )
    }

    this.logger.log(
      `VAA retrieved successfully. Submitting resolution transaction...`,
    )

    // 2. Submit resolution transaction on-chain
    const txHash = await this.blockchainService.resolveMarketWithPyth(
      market._id.toString(),
      priceUpdate,
    )
    this.logger.log(
      `Submitted resolution transaction: ${txHash}. Waiting for confirmation...`,
    )

    // 3. Wait for confirmation
    const receipt = await this.blockchainService.getTransactionReceipt(
      txHash as `0x${string}`,
    )
    this.logger.log(
      `Transaction confirmed in block ${receipt.blockNumber}. Fetching on-chain state...`,
    )

    // 4. Query the resolved status and winner from the smart contract
    const onChainState = await this.blockchainService.readOnChainMarketState(
      market._id.toString(),
    )
    if (!onChainState.resolved) {
      throw new Error("On-chain state indicates market is still unresolved.")
    }

    // 5. Update database status
    const winningOutcome = onChainState.winningIsYes ? "YES" : "NO"
    market.status = "resolved"
    market.resolvedOutcome = winningOutcome
    market.resolvedByAdmin = "0xKeeper" // Identifier for auto-resolution
    await market.save()
    await this.pvpService.resolvePvpMatchesForMarket(market._id.toString(), winningOutcome)

    this.logger.log(
      `Successfully resolved market ${market._id} to ${winningOutcome} on-chain & database.`,
    )

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    this.socketGateway.broadcastToRoom(
      `market:${market._id.toString()}`,
      "market-updated",
      {
        marketId: market._id.toString(),
      },
    )
  }
}
