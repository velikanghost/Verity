import { Injectable, NotFoundException, UnprocessableEntityException, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Post, PostDocument } from "./posts.model";
import { User, UserDocument } from "../users/users.model";
import { Market, MarketDocument, Vote, VoteDocument, VoteSide } from "../markets/markets.model";
import { Like, LikeDocument, Reshare, ReshareDocument } from "../interactions/interactions.model";
import { Comment, CommentDocument } from "../comments/comments.model";
import { serializeUser, UserResponse } from "../auth/auth.service";
import { CreateMarketPostDto } from "./posts.dto";

export interface MarketResponse {
  id: string;
  postId: string;
  post_id: string;
  authorId: string;
  author_id: string;
  question: string;
  category: string;
  deadline: string;
  resolutionSource: string;
  resolution_source: string;
  yesCondition: string;
  yes_condition: string;
  noCondition: string;
  no_condition: string;
  status: string;
  freeYesVotes: number;
  free_yes_votes: number;
  freeNoVotes: number;
  free_no_votes: number;
  totalFreeVotes: number;
  uniqueVotersCount: number;
  qualificationThreshold: number;
  uniqueVoterThreshold: number;
  marketCreationFeeUsdc: number;
  market_creation_fee_usdc: number;
  creationFeeTxHash: string | null;
  creation_fee_tx_hash: string | null;
  feeCollectorAddress: string | null;
  fee_collector_address: string | null;
  usdcYesAmount: number;
  usdc_yes_amount: number;
  usdcNoAmount: number;
  usdc_no_amount: number;
  liquidity: number;
  resolvedOutcome: string | null;
  resolved_outcome: string | null;
  resolvedByAdmin: string | null;
  resolved_by_admin: string | null;
  createdAt: string;
  created_at: string;
  updatedAt: string;
}

export interface FeedPostResponse {
  id: string;
  authorId: string;
  author_id: string;
  type: string;
  content: string;
  createdAt: string;
  created_at: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  resharesCount: number;
  sharesCount: number;
  author: UserResponse;
  market: MarketResponse | null;
  viewerLiked: boolean;
  viewerReshared: boolean;
  viewerVote: VoteSide | null;
}

const VAGUE_WORDS = ["popular", "successful", "viral", "big", "famous", "good", "better", "important"];
export const MARKET_OUTCOME_WARNING =
  "Market posts need measurable outcomes. Define this with a number, deadline, and resolution source.";

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Reshare.name) private reshareModel: Model<ReshareDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
  ) {}

  getMarketWarning(question: string): string | null {
    const normalized = question.toLowerCase();
    return VAGUE_WORDS.some((word) => normalized.includes(word)) ? MARKET_OUTCOME_WARNING : null;
  }

  serializeMarket(market: MarketDocument): MarketResponse {
    const postId = market.postId.toString();
    const authorId = market.authorId.toString();
    const createdAt = market.createdAt ? new Date(market.createdAt).toISOString() : new Date().toISOString();
    const updatedAt = market.updatedAt ? new Date(market.updatedAt).toISOString() : new Date().toISOString();
    const deadline = market.deadline ? new Date(market.deadline).toISOString() : new Date().toISOString();

    return {
      id: market.id || (market as any)._id?.toString(),
      postId,
      post_id: postId,
      authorId,
      author_id: authorId,
      question: market.question,
      category: market.category,
      deadline,
      resolutionSource: market.resolutionSource,
      resolution_source: market.resolutionSource,
      yesCondition: market.yesCondition,
      yes_condition: market.yesCondition,
      noCondition: market.noCondition,
      no_condition: market.noCondition,
      status: market.status,
      freeYesVotes: market.freeYesVotes,
      free_yes_votes: market.freeYesVotes,
      freeNoVotes: market.freeNoVotes,
      free_no_votes: market.freeNoVotes,
      totalFreeVotes: market.totalFreeVotes,
      uniqueVotersCount: market.uniqueVotersCount,
      qualificationThreshold: market.qualificationThreshold,
      uniqueVoterThreshold: market.uniqueVoterThreshold,
      marketCreationFeeUsdc: market.marketCreationFeeUsdc,
      market_creation_fee_usdc: market.marketCreationFeeUsdc,
      creationFeeTxHash: market.creationFeeTxHash,
      creation_fee_tx_hash: market.creationFeeTxHash,
      feeCollectorAddress: market.feeCollectorAddress,
      fee_collector_address: market.feeCollectorAddress,
      usdcYesAmount: market.usdcYesAmount,
      usdc_yes_amount: market.usdcYesAmount,
      usdcNoAmount: market.usdcNoAmount,
      usdc_no_amount: market.usdcNoAmount,
      liquidity: market.liquidity,
      resolvedOutcome: market.resolvedOutcome,
      resolved_outcome: market.resolvedOutcome,
      resolvedByAdmin: market.resolvedByAdmin,
      resolved_by_admin: market.resolvedByAdmin,
      createdAt,
      created_at: createdAt,
      updatedAt,
    };
  }

  private serializePost(post: PostDocument) {
    const authorId = post.authorId.toString();
    const createdAt = post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString();
    const updatedAt = post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date().toISOString();

    return {
      id: post.id || (post as any)._id?.toString(),
      authorId,
      author_id: authorId,
      type: post.type,
      content: post.content,
      createdAt,
      created_at: createdAt,
      updatedAt,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      resharesCount: post.resharesCount,
      sharesCount: post.sharesCount,
    };
  }

  private fallbackProfile(authorId: string): UserResponse {
    const now = new Date().toISOString();
    return {
      id: authorId,
      wallet_address: null,
      walletAddress: null,
      username: "unknown",
      display_name: "Unknown",
      displayName: "Unknown",
      avatar_url: null,
      avatarUrl: null,
      bio: null,
      followersCount: 0,
      followingCount: 0,
      signalPoints: 0,
      freeVotesCorrect: 0,
      freeVotesWrong: 0,
      freeVotesTotal: 0,
      created_at: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  async fetchFeed(viewerProfileId?: string, onlyMarkets = false): Promise<FeedPostResponse[]> {
    const posts = await this.postModel
      .find(onlyMarkets ? { type: "market" } : {})
      .sort({ createdAt: -1 })
      .limit(50);

    const postIds = posts.map((post) => post._id);
    const authorIds = posts.map((post) => post.authorId);
    const [authors, markets] = await Promise.all([
      this.userModel.find({ _id: { $in: authorIds } }),
      this.marketModel.find({ postId: { $in: postIds } }),
    ]);

    const authorMap = new Map(authors.map((author) => [author.id, serializeUser(author)]));
    const marketMap = new Map(markets.map((market) => [market.postId.toString(), market]));
    const marketIds = markets.map((market) => market._id);

    const [likedIds, resharedIds, votes] = await Promise.all([
      viewerProfileId
        ? this.likeModel.find({ userId: new Types.ObjectId(viewerProfileId), postId: { $in: postIds } }).select("postId")
        : Promise.resolve([]),
      viewerProfileId
        ? this.reshareModel.find({ userId: new Types.ObjectId(viewerProfileId), postId: { $in: postIds } }).select("postId")
        : Promise.resolve([]),
      viewerProfileId
        ? this.voteModel
            .find({ userId: new Types.ObjectId(viewerProfileId), marketId: { $in: marketIds }, voteType: "free" })
            .select("marketId side")
        : Promise.resolve([]),
    ]);

    const liked = new Set(likedIds.map((item) => item.postId.toString()));
    const reshared = new Set(resharedIds.map((item) => item.postId.toString()));
    const voteMap = new Map<string, VoteSide>(
      votes.map((vote) => [vote.marketId.toString(), vote.side] as [string, VoteSide]),
    );

    return posts.map((post) => {
      const base = this.serializePost(post);
      const market = marketMap.get(post.id) || null;

      return {
        ...base,
        author: authorMap.get(base.authorId) || this.fallbackProfile(base.authorId),
        market: market ? this.serializeMarket(market) : null,
        viewerLiked: liked.has(post.id),
        viewerReshared: reshared.has(post.id),
        viewerVote: market ? voteMap.get(market.id) || null : null,
      };
    });
  }

  async createNormalPost(profileId: string, content: string): Promise<FeedPostResponse> {
    const authorExists = await this.userModel.exists({ _id: profileId });
    if (!authorExists) {
      throw new NotFoundException("User not found.");
    }

    const post = await this.postModel.create({
      authorId: new Types.ObjectId(profileId),
      type: "normal",
      content: content.trim(),
    });

    const feed = await this.fetchFeed(profileId);
    const createdPost = feed.find((item) => item.id === post.id);
    if (!createdPost) {
      throw new NotFoundException("Failed to retrieve created post.");
    }
    return createdPost;
  }

  async createMarketPost(profileId: string, input: CreateMarketPostDto): Promise<{ post: FeedPostResponse; warning: string | null }> {
    const authorExists = await this.userModel.exists({ _id: profileId });
    if (!authorExists) {
      throw new NotFoundException("User not found.");
    }
    if (!input.creationFeeTxHash?.trim()) {
      throw new UnprocessableEntityException("Prediction posts require a 1 USDC Arc testnet creation transaction.");
    }
    if (!input.feeCollectorAddress?.trim()) {
      throw new UnprocessableEntityException("Prediction posts require the Arc testnet fee collector address.");
    }

    const post = await this.postModel.create({
      authorId: new Types.ObjectId(profileId),
      type: "market",
      content: input.content?.trim() || input.question.trim(),
    });

    await this.marketModel.create({
      postId: post._id,
      authorId: new Types.ObjectId(profileId),
      question: input.question.trim(),
      category: input.category.trim(),
      deadline: new Date(input.deadline),
      resolutionSource: input.resolutionSource.trim(),
      yesCondition: input.yesCondition.trim(),
      noCondition: input.noCondition.trim(),
      marketCreationFeeUsdc: 1,
      creationFeeTxHash: input.creationFeeTxHash.trim(),
      feeCollectorAddress: input.feeCollectorAddress.trim(),
      status: "open_for_votes",
    });

    const feed = await this.fetchFeed(profileId);
    const createdPost = feed.find((item) => item.id === post.id);
    if (!createdPost) {
      throw new NotFoundException("Failed to retrieve created market post.");
    }

    return {
      post: createdPost,
      warning: this.getMarketWarning(input.question),
    };
  }

  async incrementCommentsCount(postId: string): Promise<void> {
    await this.postModel.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });
  }

  async refreshPostCounters(postId: string): Promise<void> {
    const [commentsCount, likesCount, resharesCount] = await Promise.all([
      this.commentModel.countDocuments({ postId }),
      this.likeModel.countDocuments({ postId }),
      this.reshareModel.countDocuments({ postId }),
    ]);

    await this.postModel.updateOne({ _id: postId }, { commentsCount, likesCount, resharesCount });
  }
}
