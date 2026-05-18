import { Injectable, NotFoundException, ConflictException, NotImplementedException, Inject, forwardRef } from "@nestjs/common";
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

    return {
      id: position.id || (position as any)._id?.toString(),
      market_id: position.marketId.toString(),
      user_id: position.userId.toString(),
      side: position.side,
      shares: position.shares,
      avg_price: position.avgPrice,
      invested_usdc: position.investedUsdc,
      realized_pnl: position.realizedPnl,
      created_at: createdAt,
      updated_at: updatedAt,
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
    if (!["open_for_votes", "qualified"].includes(market.status)) {
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
    const nextStatus =
      totalFreeVotes >= market.qualificationThreshold && uniqueVotersCount >= market.uniqueVoterThreshold
        ? "qualified"
        : market.status;

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
    if (market.status === "tradable") {
      return this.postsService.serializeMarket(market);
    }
    if (market.status !== "qualified") {
      throw new ConflictException("Only qualified markets can be approved for USDC trading.");
    }

    const updatedMarket = await this.marketModel.findByIdAndUpdate(
      marketId,
      { status: "tradable" },
      { new: true, runValidators: true },
    );

    return this.postsService.serializeMarket(updatedMarket!);
  }

  async fetchMarketPositions(marketId: string, profileId: string): Promise<MarketPositionResponse[]> {
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

  async executeMarketTrade(input?: any): Promise<void> {
    throw new NotImplementedException("USDC trading is not implemented in this phase.");
  }
}
