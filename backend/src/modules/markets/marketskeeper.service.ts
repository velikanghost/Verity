import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Market, MarketDocument } from "./markets.model";
import { BlockchainService } from "../blockchain/blockchain.service";
import { AgentService } from "../agent/agent.service";

@Injectable()
export class MarketsKeeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketsKeeperService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    private readonly blockchainService: BlockchainService,
    private readonly agentService: AgentService,
  ) {}

  onModuleInit() {
    this.logger.log("Initializing Market Resolution Keeper...");
    // Run the keeper loop every 30 seconds
    this.intervalId = setInterval(() => this.processExpiredMarkets(), 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async processExpiredMarkets() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      await this.processPythMarkets();
      await this.processSubjectiveMarkets();
    } catch (error) {
      this.logger.error(`Error in keeper loop: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  async processPythMarkets() {
    const now = new Date();
    // Find unresolved Pyth markets that have passed their deadline
    const expiredMarkets = await this.marketModel.find({
      isPythMarket: true,
      status: { $in: ["funding_pool", "tradable"] },
      deadline: { $lte: now },
    });

    if (expiredMarkets.length > 0) {
      this.logger.log(`Found ${expiredMarkets.length} expired Pyth markets to resolve.`);
    }

    for (const market of expiredMarkets) {
      try {
        await this.resolveMarket(market);
      } catch (error) {
        this.logger.error(`Failed to auto-resolve market ${market._id}: ${error.message}`);
      }
    }
  }

  async processSubjectiveMarkets() {
    const now = new Date();
    // Find unresolved non-Pyth markets that have passed their deadline
    const expiredMarkets = await this.marketModel.find({
      isPythMarket: { $ne: true },
      status: { $in: ["funding_pool", "tradable", "resolving"] },
      deadline: { $lte: now },
    });

    if (expiredMarkets.length > 0) {
      this.logger.log(`Found ${expiredMarkets.length} expired subjective markets for AI resolution.`);
    }

    for (const market of expiredMarkets) {
      try {
        const marketIdStr = market._id.toString();
        const proposal = await this.blockchainService.readProposal(marketIdStr);

        if (proposal.proposer === "0x0000000000000000000000000000000000000000") {
          // No proposal yet -> AI agent investigates and proposes
          this.logger.log(`No active proposal found for market ${marketIdStr}. Invoking AI Agent...`);
          
          const result = await this.agentService.resolveMarket(
            market.question,
            market.yesCondition,
            market.noCondition,
            market.resolutionSource,
          );

          if (result.outcome === "INVALID") {
            this.logger.warn(`AI Agent resolved market ${marketIdStr} as INVALID. Skipping automated proposal (requires manual intervention).`);
            continue;
          }

          const proposedOutcomeBool = result.outcome === "YES";
          this.logger.log(`AI Agent proposed outcome: ${result.outcome}. Submitting proposeResolution transaction...`);

          const txHash = await this.blockchainService.proposeResolution(marketIdStr, proposedOutcomeBool);
          await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);

          // Save proposal info to DB
          market.proposalReasoning = result.reasoning;
          market.proposalCitations = result.citations;
          market.proposedOutcome = proposedOutcomeBool;
          market.proposalProposer = "0xKeeper"; // Mark keeper as proposer
          market.status = "resolving";
          await market.save();

          this.logger.log(`Successfully proposed resolution for market ${marketIdStr} (Outcome: ${result.outcome})`);
        } else {
          // Proposal already exists -> check if disputed or finalized
          if (proposal.finalized) {
            // Already finalized on-chain -> sync with DB if needed
            if (market.status !== "resolved") {
              const onChainState = await this.blockchainService.readOnChainMarketState(marketIdStr);
              market.status = "resolved";
              market.resolvedOutcome = onChainState.winningIsYes ? "YES" : "NO";
              market.resolvedByAdmin = "0xKeeper";
              await market.save();
              this.logger.log(`Synced finalized market ${marketIdStr} in database.`);
            }
          } else if (proposal.disputed) {
            // Disputed but not finalized -> mark as disputed in DB
            if (!market.disputed) {
              market.disputed = true;
              market.proposalDisputer = proposal.disputer;
              market.status = "resolving";
              await market.save();
              this.logger.log(`Market ${marketIdStr} flagged as DISPUTED in database.`);
            }
          } else {
            // Active proposal, undisputed -> check if dispute window has expired
            const elapsed = Math.floor(Date.now() / 1000) - Number(proposal.proposalTime);
            // Default dispute window is 2 hours (7200 seconds)
            const disputeWindowSeconds = 7200;
            if (elapsed > disputeWindowSeconds) {
              this.logger.log(`Dispute window for market ${marketIdStr} has elapsed. Finalizing resolution...`);
              const txHash = await this.blockchainService.finalizeResolution(marketIdStr);
              await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);

              market.status = "resolved";
              market.resolvedOutcome = proposal.proposedWinningOutcome ? "YES" : "NO";
              market.resolvedByAdmin = "0xKeeper";
              await market.save();

              this.logger.log(`Successfully finalized resolution for market ${marketIdStr}.`);
            }
          }
        }
      } catch (error) {
        this.logger.error(`Error processing subjective market ${market._id}: ${error.message}`);
      }
    }
  }

  private async resolveMarket(market: MarketDocument) {
    this.logger.log(`Auto-resolving Pyth market ${market._id} (${market.question})...`);

    // 1. Fetch price update VAA from Pyth Benchmarks API
    const timestamp = Math.floor(market.deadline.getTime() / 1000);
    const feedId = market.priceFeedId || "";
    if (!feedId) {
      throw new Error(`Market ${market._id} is marked as Pyth market but has no priceFeedId.`);
    }
    const cleanFeedId = feedId.startsWith("0x") ? feedId.slice(2) : feedId;
    const url = `https://benchmarks.pyth.network/v1/updates/price/${timestamp}?ids=${cleanFeedId}`;

    this.logger.log(`Fetching historical VAA from Benchmarks API: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Benchmarks API returned status ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { binary?: { data?: string[] } };
    const priceUpdate = data.binary?.data;
    if (!priceUpdate || priceUpdate.length === 0) {
      throw new Error("No price update binary found in Benchmarks API response.");
    }

    this.logger.log(`VAA retrieved successfully. Submitting resolution transaction...`);

    // 2. Submit resolution transaction on-chain
    const txHash = await this.blockchainService.resolveMarketWithPyth(market._id.toString(), priceUpdate);
    this.logger.log(`Submitted resolution transaction: ${txHash}. Waiting for confirmation...`);

    // 3. Wait for confirmation
    const receipt = await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);
    this.logger.log(`Transaction confirmed in block ${receipt.blockNumber}. Fetching on-chain state...`);

    // 4. Query the resolved status and winner from the smart contract
    const onChainState = await this.blockchainService.readOnChainMarketState(market._id.toString());
    if (!onChainState.resolved) {
      throw new Error("On-chain state indicates market is still unresolved.");
    }

    // 5. Update database status
    const winningOutcome = onChainState.winningIsYes ? "YES" : "NO";
    market.status = "resolved";
    market.resolvedOutcome = winningOutcome;
    market.resolvedByAdmin = "0xKeeper"; // Identifier for auto-resolution
    await market.save();

    this.logger.log(`Successfully resolved market ${market._id} to ${winningOutcome} on-chain & database.`);
  }
}
