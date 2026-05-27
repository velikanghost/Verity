import { Injectable, NotFoundException, ConflictException, NotImplementedException, Inject, forwardRef, BadRequestException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types, SortOrder } from "mongoose";
import {
  Market,
  MarketDocument,
  Vote,
  VoteDocument,
  DailyVoteUsage,
  DailyVoteUsageDocument,
  MarketPosition,
  MarketPositionDocument,
  MarketTrade,
  MarketTradeDocument,
  VoteSide,
  MarketStatus,
} from "./markets.model";
import { User, UserDocument } from "../users/users.model";
import { Post, PostDocument } from "../posts/posts.model";
import { PostsService, MarketResponse } from "../posts/posts.service";
import { BlockchainService } from "../blockchain/blockchain.service";
import { SocketGateway } from "../socket/socket.gateway";
import { NotificationsService } from "../notifications/notifications.service";


export interface DailyVotesResponse {
  votesLimit: number;
  votesUsed: number;
  votesRemaining: number;
  date: string;
}

export interface VoteResponse {
  market: MarketResponse;
  dailyVotes: DailyVotesResponse;
}

export interface MarketPositionResponse {
  id: string;
  market_id: string;
  user_id: string;
  side: VoteSide;
  shares: number;
  avg_price: number;
  invested_usdc: number;
  realized_pnl: number;
  created_at: string;
  updated_at: string;
  market_question?: string | null;
}

export interface MarketTradeResponse {
  id: string;
  market_id: string;
  user_id: string;
  side: VoteSide;
  action: string;
  shares: number;
  price: number;
  amount_usdc: number;
  fee_usdc: number;
  gross_usdc: number;
  tx_hash: string | null;
  created_at: string;
}

@Injectable()
export class MarketsService {
  constructor(
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(DailyVoteUsage.name) private dailyVoteUsageModel: Model<DailyVoteUsageDocument>,
    @InjectModel(MarketPosition.name) private marketPositionModel: Model<MarketPositionDocument>,
    @InjectModel(MarketTrade.name) private marketTradeModel: Model<MarketTradeDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
    private readonly blockchainService: BlockchainService,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  private todayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  private serializeDailyUsage(usage: DailyVoteUsageDocument | null, date = this.todayKey()): DailyVotesResponse {
    const votesLimit = usage?.votesLimit ?? 10;
    const votesUsed = usage?.votesUsed ?? 0;
    return {
      votesLimit,
      votesUsed,
      votesRemaining: Math.max(0, votesLimit - votesUsed),
      date,
    };
  }

  private isDuplicateKeyError(error: any): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
  }

  private serializePosition(position: MarketPositionDocument): MarketPositionResponse {
    const createdAt = position.createdAt ? new Date(position.createdAt).toISOString() : new Date().toISOString();
    const updatedAt = position.updatedAt ? new Date(position.updatedAt).toISOString() : new Date().toISOString();

    const m = position.marketId as any;
    const market_question = m && typeof m === "object" && "question" in m ? m.question : null;

    return {
      id: position.id || (position as any)._id?.toString(),
      market_id: m && typeof m === "object" && "_id" in m ? m._id.toString() : position.marketId.toString(),
      user_id: position.userId.toString(),
      side: position.side,
      shares: position.shares,
      avg_price: position.avgPrice,
      invested_usdc: position.investedUsdc,
      realized_pnl: position.realizedPnl,
      created_at: createdAt,
      updated_at: updatedAt,
      market_question,
    };
  }

  private serializeTrade(trade: MarketTradeDocument): MarketTradeResponse {
    const createdAt = trade.createdAt ? new Date(trade.createdAt).toISOString() : new Date().toISOString();

    return {
      id: trade.id || (trade as any)._id?.toString(),
      market_id: trade.marketId.toString(),
      user_id: trade.userId.toString(),
      side: trade.side,
      action: trade.action,
      shares: trade.shares,
      price: trade.price,
      amount_usdc: trade.amountUsdc,
      fee_usdc: trade.feeUsdc,
      gross_usdc: trade.grossUsdc,
      tx_hash: trade.txHash,
      created_at: createdAt,
    };
  }

  async getDailyVotes(userId: string, date = this.todayKey()): Promise<DailyVotesResponse> {
    const usage = await this.dailyVoteUsageModel.findOne({ userId: new Types.ObjectId(userId), date });
    return this.serializeDailyUsage(usage, date);
  }

  private async getOrCreateDailyUsage(userId: string, date = this.todayKey()): Promise<DailyVoteUsageDocument> {
    return this.dailyVoteUsageModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), date },
      { $setOnInsert: { userId: new Types.ObjectId(userId), date, votesUsed: 0, votesLimit: 10 } },
      { upsert: true, new: true, runValidators: true },
    );
  }

  private async reserveDailyVote(userId: string, date = this.todayKey()): Promise<DailyVoteUsageDocument> {
    await this.getOrCreateDailyUsage(userId, date);

    const usage = await this.dailyVoteUsageModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        date,
        $expr: { $lt: ["$votesUsed", "$votesLimit"] },
      },
      { $inc: { votesUsed: 1 } },
      { new: true, runValidators: true },
    );

    if (!usage) {
      throw new ConflictException("You have used all 10 votes today. Votes reset tomorrow.");
    }

    return usage;
  }

  private async releaseDailyVote(userId: string, date = this.todayKey()): Promise<void> {
    await this.dailyVoteUsageModel.updateOne(
      { userId: new Types.ObjectId(userId), date, votesUsed: { $gt: 0 } },
      { $inc: { votesUsed: -1 } },
    );
  }

  async castFreeVote(marketId: string, userId: string, side: VoteSide): Promise<VoteResponse> {
    const [market, userExists] = await Promise.all([
      this.marketModel.findById(marketId),
      this.userModel.exists({ _id: userId }),
    ]);

    if (!market) {
      throw new NotFoundException("Market not found.");
    }
    if (!userExists) {
      throw new NotFoundException("User not found.");
    }
    if (!["open_for_votes", "qualified", "funding_pool", "tradable"].includes(market.status)) {
      throw new ConflictException("This market is not open for free voting.");
    }

    const existingVote = await this.voteModel.exists({
      marketId: new Types.ObjectId(marketId),
      userId: new Types.ObjectId(userId),
      voteType: "free",
    });
    if (existingVote) {
      throw new ConflictException("You have already voted on this market.");
    }

    const usageDate = this.todayKey();
    const usage = await this.reserveDailyVote(userId, usageDate);
    try {
      await this.voteModel.create({
        marketId: new Types.ObjectId(marketId),
        userId: new Types.ObjectId(userId),
        side,
        voteType: "free",
      });
    } catch (error) {
      await this.releaseDailyVote(userId, usageDate);
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("You have already voted on this market.");
      }
      throw error;
    }

    const [freeYesVotes, freeNoVotes, uniqueVotersCount] = await Promise.all([
      this.voteModel.countDocuments({ marketId: new Types.ObjectId(marketId), voteType: "free", side: "YES" }),
      this.voteModel.countDocuments({ marketId: new Types.ObjectId(marketId), voteType: "free", side: "NO" }),
      this.voteModel.distinct("userId", { marketId: new Types.ObjectId(marketId), voteType: "free" }).then((ids) => ids.length),
    ]);
    const totalFreeVotes = freeYesVotes + freeNoVotes;

    let nextStatus = market.status;
    if (market.status === "open_for_votes") {
      const hasMetThresholds = freeYesVotes >= 30;
      if (hasMetThresholds) {
        nextStatus = "qualified";
      }
    }

    const updatedMarket = await this.marketModel.findByIdAndUpdate(
      marketId,
      {
        freeYesVotes,
        freeNoVotes,
        totalFreeVotes,
        uniqueVotersCount,
        status: nextStatus,
      },
      { new: true, runValidators: true },
    );

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
    this.socketGateway.broadcastToRoom(`post:${market.postId}`, "post-updated", {});

    return {
      market: this.postsService.serializeMarket(updatedMarket!),
      dailyVotes: this.serializeDailyUsage(usage, usageDate),
    };
  }

  async fetchMarkets(filters: {
    status?: MarketStatus;
    category?: string;
    qualified?: boolean;
    open_for_votes?: boolean;
    trending?: boolean;
    newest?: boolean;
  }): Promise<MarketResponse[]> {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.qualified) query.status = "qualified";
    if (filters.open_for_votes) query.status = "open_for_votes";

    const sort: Record<string, SortOrder> = filters.trending
      ? { totalFreeVotes: -1, uniqueVotersCount: -1, createdAt: -1 }
      : { createdAt: filters.newest === false ? 1 : -1 };

    const markets = await this.marketModel.find(query).sort(sort).limit(100);
    return markets.map((m) => this.postsService.serializeMarket(m));
  }

  async fetchMarketDetail(marketId: string, viewerProfileId?: string) {
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    const feed = await this.postsService.fetchFeed(viewerProfileId, true);
    const feedItem = feed.find((item) => item.market?.id === market.id);
    if (feedItem) return feedItem;

    const post = await this.postModel.findById(market.postId);
    if (!post) {
      throw new NotFoundException("Market post not found.");
    }

    return {
      id: post.id,
      authorId: market.authorId.toString(),
      author_id: market.authorId.toString(),
      type: "market",
      content: post.content,
      createdAt: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString(),
      created_at: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: post.updatedAt ? post.updatedAt.toISOString() : new Date().toISOString(),
      likesCount: 0,
      commentsCount: post.commentsCount,
      resharesCount: post.resharesCount,
      sharesCount: post.sharesCount,
      author: null,
      market: this.postsService.serializeMarket(market),
      viewerLiked: false,
      viewerReshared: false,
      viewerVote: null,
    };
  }

  async approveMarketForTrading(marketId: string): Promise<MarketResponse> {
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException("Market not found.");
    }
    if (market.status === "funding_pool") {
      return this.postsService.serializeMarket(market);
    }
    if (market.status !== "qualified") {
      throw new ConflictException("Only qualified markets can be approved for USDC trading.");
    }

    // Look up creator wallet address
    const creator = await this.userModel.findById(market.authorId);
    if (!creator || !creator.walletAddress) {
      throw new BadRequestException("Market creator does not have a linked wallet address.");
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fundingDeadline = market.deadline < sevenDaysFromNow ? market.deadline : sevenDaysFromNow;

    const deadlineUnix = Math.floor(market.deadline.getTime() / 1000);
    const fundingDeadlineUnix = Math.floor(fundingDeadline.getTime() / 1000);

    // Register market on-chain so depositPreMarketLiquidity won't revert
    try {
      if (market.isPythMarket && market.priceFeedId && market.targetPrice != null) {
        await this.blockchainService.registerPythMarket(
          marketId,
          creator.walletAddress,
          deadlineUnix,
          fundingDeadlineUnix,
          market.priceFeedId,
          market.targetPrice,
          market.resolveAbove ?? true,
        );
      } else {
        await this.blockchainService.registerMarket(
          marketId,
          creator.walletAddress,
          deadlineUnix,
          fundingDeadlineUnix,
        );
      }
    } catch (error) {
      // If already registered on-chain, ignore the error and continue
      const msg = error?.message || "";
      if (!msg.includes("MarketAlreadyRegistered")) {
        throw error;
      }
    }

    const updatedMarket = await this.marketModel.findByIdAndUpdate(
      marketId,
      { status: "funding_pool", fundingDeadline },
      { new: true, runValidators: true },
    );

    return this.postsService.serializeMarket(updatedMarket!);
  }

  async fetchMarketPositions(marketId: string, profileId: string): Promise<MarketPositionResponse[]> {
    const user = await this.userModel.findById(profileId);
    if (user && user.walletAddress) {
      try {
        const market = await this.marketModel.findById(marketId);
        const isResolved = market && (market.status === 'resolved' || market.resolvedOutcome);
        const winningOutcome = market?.resolvedOutcome;

        const onChain = await this.blockchainService.getUserOnChainBalances(marketId, user.walletAddress);

        // Sync YES Position
        const isYesLosing = isResolved && winningOutcome === "NO";
        if (!isYesLosing) {
          if (onChain.yesBalance > 0) {
            await this.marketPositionModel.updateOne(
              {
                marketId: new Types.ObjectId(marketId),
                userId: new Types.ObjectId(profileId),
                side: "YES",
              },
              {
                $set: {
                  shares: onChain.yesBalance,
                },
                $setOnInsert: {
                  avgPrice: 0.5,
                  investedUsdc: onChain.yesBalance * 0.5,
                  realizedPnl: 0,
                },
              },
              { upsert: true }
            );
          } else {
            await this.marketPositionModel.deleteOne({
              marketId: new Types.ObjectId(marketId),
              userId: new Types.ObjectId(profileId),
              side: "YES",
            });
          }
        }

        // Sync NO Position
        const isNoLosing = isResolved && winningOutcome === "YES";
        if (!isNoLosing) {
          if (onChain.noBalance > 0) {
            await this.marketPositionModel.updateOne(
              {
                marketId: new Types.ObjectId(marketId),
                userId: new Types.ObjectId(profileId),
                side: "NO",
              },
              {
                $set: {
                  shares: onChain.noBalance,
                },
                $setOnInsert: {
                  avgPrice: 0.5,
                  investedUsdc: onChain.noBalance * 0.5,
                  realizedPnl: 0,
                },
              },
              { upsert: true }
            );
          } else {
            await this.marketPositionModel.deleteOne({
              marketId: new Types.ObjectId(marketId),
              userId: new Types.ObjectId(profileId),
              side: "NO",
            });
          }
        }
      } catch (err) {
        // Fallback to DB if RPC call fails
      }
    }

    const positions = await this.marketPositionModel.find({
      marketId: new Types.ObjectId(marketId),
      userId: new Types.ObjectId(profileId),
      shares: { $gt: 0 },
    }).sort({ updatedAt: -1 });

    return positions.map((p) => this.serializePosition(p));
  }

  async fetchMarketTrades(marketId: string): Promise<MarketTradeResponse[]> {
    const trades = await this.marketTradeModel.find({
      marketId: new Types.ObjectId(marketId),
    })
      .sort({ createdAt: -1 })
      .limit(25);

    return trades.map((t) => this.serializeTrade(t));
  }

  async executeMarketTrade(marketId: string, dto: any): Promise<void> {
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException("Market not found.");
    }
    const user = await this.userModel.findById(dto.profileId);
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    // Verify txHash if provided
    if (dto.txHash) {
      await this.blockchainService.getTransactionReceipt(dto.txHash as `0x${string}`);
    }

    const amountUsdc = dto.amount;
    const grossUsdc = dto.grossAmount || dto.amount;
    const feeUsdc = dto.feeAmount || 0;
    
    // Create MarketTrade record
    const shares = dto.grossAmount || dto.amount;
    const price = amountUsdc / (shares || 1);

    await this.marketTradeModel.create({
      marketId: new Types.ObjectId(marketId),
      userId: new Types.ObjectId(dto.profileId),
      side: dto.side,
      action: dto.action,
      shares,
      price,
      amountUsdc,
      feeUsdc,
      grossUsdc,
      txHash: dto.txHash || null,
    });

    // Update or create Position
    let position = await this.marketPositionModel.findOne({
      marketId: new Types.ObjectId(marketId),
      userId: new Types.ObjectId(dto.profileId),
      side: dto.side,
    });

    if (dto.action === "BUY") {
      if (position) {
        position.shares += shares;
        position.investedUsdc += amountUsdc;
        position.avgPrice = position.investedUsdc / (position.shares || 1);
        await position.save();
      } else {
        await this.marketPositionModel.create({
          marketId: new Types.ObjectId(marketId),
          userId: new Types.ObjectId(dto.profileId),
          side: dto.side,
          shares,
          avgPrice: price,
          investedUsdc: amountUsdc,
          realizedPnl: 0,
        });
      }
    } else if (dto.action === "SELL") {
      if (!position) {
        throw new BadRequestException("No position to sell.");
      }
      const oldShares = position.shares;
      position.shares = Math.max(0, position.shares - shares);
      
      const exitPrice = price;
      const avgPrice = position.avgPrice;
      const pnl = (exitPrice - avgPrice) * shares;
      
      position.realizedPnl += pnl;
      position.investedUsdc = Math.max(0, position.investedUsdc - (avgPrice * shares));
      
      if (position.shares === 0) {
        await this.marketPositionModel.deleteOne({ _id: position._id });
      } else {
        await position.save();
      }
    }

    // Sync market balances and prices from chain
    await this.syncMarketPrices(marketId);

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
    this.socketGateway.broadcastToRoom(`post:${market.postId}`, "post-updated", {});
    this.socketGateway.broadcastToRoom(`user:${dto.profileId}`, "user-updated", {});
  }

  async syncMarketPrices(marketId: string): Promise<void> {
    try {
      const balances = await this.blockchainService.readPoolBalances(marketId as `0x${string}`);
      await this.marketModel.findByIdAndUpdate(marketId, {
        usdcYesAmount: Number(balances.yesBalance) / 1e6,
        usdcNoAmount: Number(balances.noBalance) / 1e6,
        liquidity: Number(balances.totalDeposited) / 1e6,
      });
    } catch (e) {
      // ignore
    }
  }

  async resolveMarket(
    marketId: string,
    winningOutcome: "YES" | "NO",
    txHash: string,
    adminAddress: string,
  ): Promise<MarketResponse> {
    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException("Market not found.");
    }

    // Verify transaction receipt
    await this.blockchainService.getTransactionReceipt(txHash as `0x${string}`);

    market.status = "resolved";
    market.resolvedOutcome = winningOutcome;
    market.resolvedByAdmin = adminAddress;
    await market.save();

    // Trigger Notification for Creator
    try {
      const recipientId = market.authorId.toString();
      await this.notificationsService.createNotification(
        recipientId,
        "0x28738040d191ff30673f546FB6BF997E6cdA6dbF",
        "settlement",
        "Market resolved",
        `Your market "${market.question}" has been resolved to ${winningOutcome}.`,
        market.id || (market as any)._id?.toString(),
      );
    } catch (err) {
      // Ignore notification failures
    }

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {});
    this.socketGateway.broadcastToRoom(`post:${market.postId}`, "post-updated", {});

    return this.postsService.serializeMarket(market);
  }

  async devQualify(marketId: string): Promise<MarketResponse> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev-qualify is not available in production.');
    }

    const market = await this.marketModel.findById(marketId);
    if (!market) {
      throw new NotFoundException('Market not found.');
    }
    if (market.status !== 'open_for_votes') {
      throw new ConflictException(`Market is already in '${market.status}' status.`);
    }

    market.status = 'qualified';
    market.totalFreeVotes = 30;
    market.uniqueVotersCount = 30;
    market.freeYesVotes = 30;
    market.freeNoVotes = 0;
    await market.save();

    return this.postsService.serializeMarket(market);
  }

  async fetchAllUserPositions(userId: string): Promise<MarketPositionResponse[]> {
    const positions = await this.marketPositionModel.find({
      userId: new Types.ObjectId(userId),
      shares: { $gt: 0 },
    })
      .populate("marketId")
      .sort({ updatedAt: -1 });

    return positions.map((p) => this.serializePosition(p));
  }
}
