import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { BlockchainService } from "../blockchain/blockchain.service"
import { LiquidityService } from "../liquidity/liquidity.service"
import { Model, Types } from "mongoose"
import { Post, PostDocument } from "./posts.model"
import { User, UserDocument } from "../users/users.model"
import {
  Market,
  MarketDocument,
  Vote,
  VoteDocument,
  VoteSide,
} from "../markets/markets.model"
import {
  Like,
  LikeDocument,
  Reshare,
  ReshareDocument,
} from "../interactions/interactions.model"
import { Comment, CommentDocument } from "../comments/comments.model"
import {
  serializeUser,
  placeholderUserProfile,
  UserResponse,
} from "../auth/auth.service"
import { CreateMarketPostDto } from "./posts.dto"
import { SocketGateway } from "../socket/socket.gateway"

export interface MarketResponse {
  id: string
  postId: string
  post_id: string
  authorId: string
  author_id: string
  question: string
  category: string
  deadline: string
  resolutionSource: string
  resolution_source: string
  yesCondition: string
  yes_condition: string
  noCondition: string
  no_condition: string
  status: string
  freeYesVotes: number
  free_yes_votes: number
  freeNoVotes: number
  free_no_votes: number
  totalFreeVotes: number
  uniqueVotersCount: number
  qualificationThreshold: number
  uniqueVoterThreshold: number
  marketCreationFeeUsdc: number
  market_creation_fee_usdc: number
  creationFeeTxHash: string | null
  creation_fee_tx_hash: string | null
  feeCollectorAddress: string | null
  fee_collector_address: string | null
  usdcYesAmount: number
  usdc_yes_amount: number
  usdcNoAmount: number
  usdc_no_amount: number
  liquidity: number
  resolvedOutcome: string | null
  resolved_outcome: string | null
  resolvedByAdmin: string | null
  resolved_by_admin: string | null
  priceFeedId: string | null
  price_feed_id: string | null
  targetPrice: number | null
  target_price: number | null
  resolveAbove: boolean | null
  resolve_above: boolean | null
  isPythMarket: boolean
  is_pyth_market: boolean
  proposalReasoning?: string | null
  proposalCitations?: string[] | null
  proposalProposer?: string | null
  proposalDisputer?: string | null
  disputed?: boolean
  proposedOutcome?: boolean | null
  marketType: "binary" | "parent" | "child"
  parentMarketId: string | null
  optionName: string | null
  childMarkets?: MarketResponse[] | null
  createdAt: string
  created_at: string
  updatedAt: string
}

export interface FeedPostResponse {
  id: string
  authorId: string
  author_id: string
  type: string
  content: string
  createdAt: string
  created_at: string
  updatedAt: string
  likesCount: number
  commentsCount: number
  resharesCount: number
  sharesCount: number
  author: UserResponse
  market: MarketResponse | null
  viewerLiked: boolean
  viewerReshared: boolean
  viewerVote: VoteSide | null
  parentPost?: FeedPostResponse | null
}

const VAGUE_WORDS = [
  "popular",
  "successful",
  "viral",
  "big",
  "famous",
  "good",
  "better",
  "important",
]
export const MARKET_OUTCOME_WARNING =
  "Market posts need measurable outcomes. Define this with a number, deadline, and resolution source."

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Reshare.name) private reshareModel: Model<ReshareDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private blockchainService: BlockchainService,
    private liquidityService: LiquidityService,
    private socketGateway: SocketGateway,
  ) {}

  validateMarketHeuristics(input: CreateMarketPostDto) {
    const question = input.question.trim()
    if (!question.endsWith("?")) {
      throw new BadRequestException(
        "Market question must end with a question mark '?'.",
      )
    }

    const resolutionSource = input.resolutionSource.trim()
    if (resolutionSource.length < 5) {
      throw new BadRequestException(
        "Resolution source must specify a clear, verifiable platform or oracle.",
      )
    }

    const yesCondition = input.yesCondition.trim()
    const noCondition = input.noCondition.trim()
    if (yesCondition.length < 12 || noCondition.length < 12) {
      throw new BadRequestException(
        "YES and NO resolution conditions must be detailed and clear (minimum 12 characters).",
      )
    }
  }

  getMarketWarning(question: string): string | null {
    const normalized = question.toLowerCase()
    return VAGUE_WORDS.some((word) => normalized.includes(word))
      ? MARKET_OUTCOME_WARNING
      : null
  }

  serializeMarket(
    market: MarketDocument,
    childMarkets: MarketDocument[] = [],
  ): MarketResponse {
    const postId = market.postId.toString()
    const authorId = market.authorId.toString()
    const createdAt = market.createdAt
      ? new Date(market.createdAt).toISOString()
      : new Date().toISOString()
    const updatedAt = market.updatedAt
      ? new Date(market.updatedAt).toISOString()
      : new Date().toISOString()
    const deadline = market.deadline
      ? new Date(market.deadline).toISOString()
      : new Date().toISOString()

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
      priceFeedId: market.priceFeedId,
      price_feed_id: market.priceFeedId,
      targetPrice: market.targetPrice,
      target_price: market.targetPrice,
      resolveAbove: market.resolveAbove,
      resolve_above: market.resolveAbove,
      isPythMarket: market.isPythMarket,
      is_pyth_market: market.isPythMarket,
      proposalReasoning: market.proposalReasoning,
      proposalCitations: market.proposalCitations,
      proposalProposer: market.proposalProposer,
      proposalDisputer: market.proposalDisputer,
      disputed: market.disputed,
      proposedOutcome: market.proposedOutcome,
      marketType: market.marketType || "binary",
      parentMarketId: market.parentMarketId
        ? market.parentMarketId.toString()
        : null,
      optionName: market.optionName || null,
      childMarkets:
        childMarkets && childMarkets.length > 0
          ? childMarkets.map((c) => this.serializeMarket(c))
          : null,
      createdAt,
      created_at: createdAt,
      updatedAt,
    }
  }

  private serializePost(post: PostDocument) {
    const authorId = post.authorId.toString()
    const createdAt = post.createdAt
      ? new Date(post.createdAt).toISOString()
      : new Date().toISOString()
    const updatedAt = post.updatedAt
      ? new Date(post.updatedAt).toISOString()
      : new Date().toISOString()

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
    }
  }

  async fetchFeed(
    viewerProfileId?: string,
    onlyMarkets = false,
    profileId?: string,
    tab?: string,
  ): Promise<FeedPostResponse[]> {
    let filter: any = {}

    if (profileId) {
      const pId = new Types.ObjectId(profileId)
      if (tab === "posts") {
        filter = { authorId: pId }
      } else if (tab === "markets") {
        filter = { authorId: pId, type: "market" }
      } else if (tab === "likes") {
        const likes = await this.likeModel
          .find({ userId: pId })
          .select("postId")
        const postIds = likes.map((l) => l.postId)
        filter = { _id: { $in: postIds } }
      } else if (tab === "reshares") {
        const reshares = await this.reshareModel
          .find({ userId: pId })
          .select("postId")
        const postIds = reshares.map((r) => r.postId)
        filter = { _id: { $in: postIds } }
      } else if (tab === "comments") {
        const comments = await this.commentModel.aggregate([
          { $match: { authorId: new Types.ObjectId(pId) } },
          { $sort: { createdAt: -1 } },
          { $limit: 50 },
          {
            $lookup: {
              from: "users",
              localField: "authorId",
              foreignField: "_id",
              as: "commentAuthor",
            },
          },
          {
            $unwind: {
              path: "$commentAuthor",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "posts",
              localField: "postId",
              foreignField: "_id",
              as: "parentPost",
            },
          },
          {
            $unwind: { path: "$parentPost", preserveNullAndEmptyArrays: true },
          },
          {
            $lookup: {
              from: "users",
              localField: "parentPost.authorId",
              foreignField: "_id",
              as: "parentAuthor",
            },
          },
          {
            $unwind: {
              path: "$parentAuthor",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "markets",
              let: { postId: "$postId" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$postId", "$$postId"] },
                    marketType: { $ne: "child" },
                  },
                },
              ],
              as: "parentMarket",
            },
          },
          {
            $unwind: {
              path: "$parentMarket",
              preserveNullAndEmptyArrays: true,
            },
          },
        ])

        if (comments.length === 0) {
          return []
        }

        // Collect IDs for querying viewer status
        const parentPostIdsFetched = comments
          .filter((c) => c.parentPost)
          .map((c) => c.parentPost._id)
        const parentMarketIds = comments
          .filter((c) => c.parentMarket)
          .map((c) => c.parentMarket._id)

        const [likedIds, resharedIds, votes] = await Promise.all([
          viewerProfileId && parentPostIdsFetched.length > 0
            ? this.likeModel
                .find({
                  userId: new Types.ObjectId(viewerProfileId),
                  postId: { $in: parentPostIdsFetched },
                })
                .select("postId")
            : Promise.resolve([]),
          viewerProfileId && parentPostIdsFetched.length > 0
            ? this.reshareModel
                .find({
                  userId: new Types.ObjectId(viewerProfileId),
                  postId: { $in: parentPostIdsFetched },
                })
                .select("postId")
            : Promise.resolve([]),
          viewerProfileId && parentMarketIds.length > 0
            ? this.voteModel
                .find({
                  userId: new Types.ObjectId(viewerProfileId),
                  marketId: { $in: parentMarketIds },
                  voteType: "free",
                })
                .select("marketId side")
            : Promise.resolve([]),
        ])

        const liked = new Set(likedIds.map((item) => item.postId.toString()))
        const reshared = new Set(
          resharedIds.map((item) => item.postId.toString()),
        )
        const voteMap = new Map<string, VoteSide>(
          votes.map(
            (vote) =>
              [vote.marketId.toString(), vote.side] as [string, VoteSide],
          ),
        )

        return comments.map((comment) => {
          const createdAt = comment.createdAt
            ? new Date(comment.createdAt).toISOString()
            : new Date().toISOString()
          const updatedAt = comment.updatedAt
            ? new Date(comment.updatedAt).toISOString()
            : new Date().toISOString()

          const serializedCommentAuthor = comment.commentAuthor
            ? serializeUser(comment.commentAuthor)
            : placeholderUserProfile(profileId)

          let parentPostSerialized: FeedPostResponse | null = null
          if (comment.parentPost) {
            const parentPost = comment.parentPost
            const parentAuthor = comment.parentAuthor
            const parentMarket = comment.parentMarket

            const base = this.serializePost(parentPost)
            parentPostSerialized = {
              ...base,
              author: parentAuthor
                ? serializeUser(parentAuthor)
                : placeholderUserProfile(base.authorId),
              market: parentMarket ? this.serializeMarket(parentMarket) : null,
              viewerLiked: liked.has(parentPost._id.toString()),
              viewerReshared: reshared.has(parentPost._id.toString()),
              viewerVote: parentMarket
                ? voteMap.get(parentMarket._id.toString()) || null
                : null,
            }
          }

          return {
            id: comment._id.toString(),
            authorId: comment.authorId.toString(),
            author_id: comment.authorId.toString(),
            type: "comment",
            content: comment.content,
            createdAt,
            created_at: createdAt,
            updatedAt,
            likesCount: comment.likesCount || 0,
            commentsCount: 0,
            resharesCount: 0,
            sharesCount: 0,
            author: serializedCommentAuthor,
            market: null,
            viewerLiked: false,
            viewerReshared: false,
            viewerVote: null,
            parentPost: parentPostSerialized,
          }
        })
      } else {
        filter = { authorId: pId }
      }
    } else if (onlyMarkets) {
      filter = { type: "market" }
    }

    // Exclude PvP Arena posts from default feed
    const pvpMarkets = await this.marketModel.find({ category: "pvp" }).select("postId")
    const pvpPostIds = pvpMarkets.map((m) => m.postId)
    if (pvpPostIds.length > 0) {
      if (filter._id) {
        filter = {
          $and: [
            { _id: filter._id },
            { _id: { $nin: pvpPostIds } }
          ]
        }
      } else {
        filter._id = { $nin: pvpPostIds }
      }
    }

    const posts = await this.postModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)

    const postIds = posts.map((post) => post._id)
    const authorIds = posts.map((post) => post.authorId)
    const [authors, markets] = await Promise.all([
      this.userModel.find({ _id: { $in: authorIds } }),
      this.marketModel.find({
        postId: { $in: postIds },
        marketType: { $ne: "child" },
      }),
    ])

    // Fetch child markets for any parent markets in the feed
    const parentMarketIds = markets
      .filter((m) => m.marketType === "parent")
      .map((m) => m._id)

    const allChildMarkets =
      parentMarketIds.length > 0
        ? await this.marketModel.find({
            parentMarketId: { $in: parentMarketIds },
          })
        : []

    const childMarketsMap = new Map<string, MarketDocument[]>()
    for (const child of allChildMarkets) {
      const parentIdStr = child.parentMarketId!.toString()
      if (!childMarketsMap.has(parentIdStr)) {
        childMarketsMap.set(parentIdStr, [])
      }
      childMarketsMap.get(parentIdStr)!.push(child)
    }

    const authorMap = new Map(
      authors.map((author) => [author.id, serializeUser(author)]),
    )
    const marketMap = new Map(
      markets.map((market) => [market.postId.toString(), market]),
    )
    const marketIds = markets.map((market) => market._id)

    const [likedIds, resharedIds, votes] = await Promise.all([
      viewerProfileId
        ? this.likeModel
            .find({
              userId: new Types.ObjectId(viewerProfileId),
              postId: { $in: postIds },
            })
            .select("postId")
        : Promise.resolve([]),
      viewerProfileId
        ? this.reshareModel
            .find({
              userId: new Types.ObjectId(viewerProfileId),
              postId: { $in: postIds },
            })
            .select("postId")
        : Promise.resolve([]),
      viewerProfileId
        ? this.voteModel
            .find({
              userId: new Types.ObjectId(viewerProfileId),
              marketId: { $in: marketIds },
              voteType: "free",
            })
            .select("marketId side")
        : Promise.resolve([]),
    ])

    const liked = new Set(likedIds.map((item) => item.postId.toString()))
    const reshared = new Set(resharedIds.map((item) => item.postId.toString()))
    const voteMap = new Map<string, VoteSide>(
      votes.map(
        (vote) => [vote.marketId.toString(), vote.side] as [string, VoteSide],
      ),
    )

    return posts.map((post) => {
      const base = this.serializePost(post)
      const market = marketMap.get(post.id) || null
      const children = market ? childMarketsMap.get(market.id) || [] : []

      return {
        ...base,
        author:
          authorMap.get(base.authorId) || placeholderUserProfile(base.authorId),
        market: market ? this.serializeMarket(market, children) : null,
        viewerLiked: liked.has(post.id),
        viewerReshared: reshared.has(post.id),
        viewerVote: market ? voteMap.get(market.id) || null : null,
      }
    })
  }

  async findPostById(
    postId: string,
    viewerProfileId?: string,
  ): Promise<FeedPostResponse> {
    const post = await this.postModel.findById(postId)
    if (!post) {
      throw new NotFoundException("Post not found.")
    }

    const [author, market] = await Promise.all([
      this.userModel.findById(post.authorId),
      this.marketModel.findOne({
        postId: post._id,
        marketType: { $ne: "child" },
      }),
    ])

    let childMarkets: MarketDocument[] = []
    if (market && market.marketType === "parent") {
      childMarkets = await this.marketModel.find({ parentMarketId: market._id })
    }

    const marketId = market?._id
    const [viewerLiked, viewerReshared, viewerVote] = await Promise.all([
      viewerProfileId
        ? this.likeModel.exists({
            userId: new Types.ObjectId(viewerProfileId),
            postId: post._id,
          })
        : Promise.resolve(null),
      viewerProfileId
        ? this.reshareModel.exists({
            userId: new Types.ObjectId(viewerProfileId),
            postId: post._id,
          })
        : Promise.resolve(null),
      viewerProfileId && marketId
        ? this.voteModel
            .findOne({
              userId: new Types.ObjectId(viewerProfileId),
              marketId,
              voteType: "free",
            })
            .select("side")
        : Promise.resolve(null),
    ])

    const base = this.serializePost(post)

    return {
      ...base,
      author: author
        ? serializeUser(author)
        : placeholderUserProfile(post.authorId.toString()),
      market: market ? this.serializeMarket(market, childMarkets) : null,
      viewerLiked: !!viewerLiked,
      viewerReshared: !!viewerReshared,
      viewerVote: viewerVote ? (viewerVote.side as VoteSide) : null,
    }
  }

  async createNormalPost(
    profileId: string,
    content: string,
  ): Promise<FeedPostResponse> {
    const authorExists = await this.userModel.exists({ _id: profileId })
    if (!authorExists) {
      throw new NotFoundException("User not found.")
    }

    const post = await this.postModel.create({
      authorId: new Types.ObjectId(profileId),
      type: "normal",
      content: content.trim(),
    })

    const createdPost = await this.findPostById(post.id, profileId)
    this.logger.log(
      `Successfully created normal post ${post.id} by author ${profileId}`,
    )

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    return createdPost
  }

  async createMarketPost(
    profileId: string,
    input: CreateMarketPostDto,
  ): Promise<{ post: FeedPostResponse; warning: string | null }> {
    const author = await this.userModel.findById(profileId)
    if (!author) {
      throw new NotFoundException("User not found.")
    }
    if (!author.walletAddress) {
      throw new BadRequestException(
        "User does not have a linked wallet address.",
      )
    }
    if (!input.creationFeeTxHash?.trim()) {
      throw new UnprocessableEntityException(
        "Prediction posts require a 1 USDC Arc testnet creation transaction.",
      )
    }
    if (!input.feeCollectorAddress?.trim()) {
      throw new UnprocessableEntityException(
        "Prediction posts require the Arc testnet fee collector address.",
      )
    }

    // Check if the transaction hash has already been used by any existing market
    const existingMarket = await this.marketModel.findOne({
      creationFeeTxHash: input.creationFeeTxHash.trim(),
    })
    if (existingMarket) {
      throw new BadRequestException(
        "This transaction hash has already been used to create a market.",
      )
    }

    this.validateMarketHeuristics(input)

    const mId = input.marketId
      ? new Types.ObjectId(input.marketId)
      : new Types.ObjectId()

    const isMultiOption =
      input.options &&
      input.options.length > 0 &&
      input.optionMarketIds &&
      input.optionMarketIds.length > 0

    const post = await this.postModel.create({
      authorId: new Types.ObjectId(profileId),
      type: "market",
      content: input.content?.trim() || input.question.trim(),
    })

    const isPythMarket = !!input.priceFeedId

    if (isMultiOption) {
      // 1. Create parent market in DB
      const parentMarketId = mId
      const parentMarket = await this.marketModel.create({
        _id: parentMarketId,
        postId: post._id,
        authorId: new Types.ObjectId(profileId),
        question: input.question.trim(),
        category: input.category.trim(),
        deadline: new Date(input.deadline),
        resolutionSource: input.resolutionSource.trim(),
        yesCondition: "Any of the options wins",
        noCondition: "None of the options wins",
        marketCreationFeeUsdc: 1,
        creationFeeTxHash: input.creationFeeTxHash.trim(),
        feeCollectorAddress: input.feeCollectorAddress.trim(),
        status: "open_for_votes",
        isPythMarket: false,
        marketType: "parent",
        parentMarketId: null,
        optionName: null,
      })

      // 2. Loop and create child markets
      for (let i = 0; i < input.options!.length; i++) {
        const option = input.options![i]
        const childMarketIdStr = input.optionMarketIds![i]
        const childMarketId = new Types.ObjectId(childMarketIdStr)

        // Verify pre-deposit for each child market
        const childAmountBigint =
          await this.blockchainService.verifyCreateMarketPreDeposit(
            input.creationFeeTxHash.trim(),
            childMarketIdStr,
          )

        if (childAmountBigint === null) {
          throw new BadRequestException(
            `Failed to verify createMarketPreDeposit transaction on-chain for option ${option} (${childMarketIdStr}).`,
          )
        }
        const childCreatorDepositUsdc = Number(childAmountBigint) / 1e6

        await this.marketModel.create({
          _id: childMarketId,
          postId: post._id,
          authorId: new Types.ObjectId(profileId),
          question: `${input.question.trim()} (${option.trim()})`,
          category: input.category.trim(),
          deadline: new Date(input.deadline),
          resolutionSource: input.resolutionSource.trim(),
          yesCondition: `${option.trim()} resolves to YES`,
          noCondition: `${option.trim()} resolves to NO`,
          marketCreationFeeUsdc: 1,
          creationFeeTxHash: input.creationFeeTxHash.trim(),
          feeCollectorAddress: input.feeCollectorAddress.trim(),
          status: "open_for_votes",
          isPythMarket: false,
          marketType: "child",
          parentMarketId: parentMarketId,
          optionName: option.trim(),
        })

        // Initialize liquidity pool in DB for the child market
        await this.liquidityService.initializePoolFromPreDeposit(
          childMarketIdStr,
          profileId,
          author.walletAddress,
          input.creationFeeTxHash.trim(),
          childCreatorDepositUsdc,
        )
      }
    } else {
      // Binary (original single option flow)
      const amountBigint =
        await this.blockchainService.verifyCreateMarketPreDeposit(
          input.creationFeeTxHash,
          mId.toString(),
        )
      if (amountBigint === null) {
        throw new BadRequestException(
          "Invalid or failed createMarketPreDeposit transaction on-chain.",
        )
      }
      const creatorDepositUsdc = Number(amountBigint) / 1e6

      await this.marketModel.create({
        _id: mId,
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
        priceFeedId: isPythMarket ? input.priceFeedId!.trim() : null,
        targetPrice: isPythMarket ? input.targetPrice : null,
        resolveAbove: isPythMarket ? input.resolveAbove : null,
        isPythMarket,
        marketType: "binary",
      })

      // Automatically initialize liquidity pool in DB from the pre-deposit
      await this.liquidityService.initializePoolFromPreDeposit(
        mId.toString(),
        profileId,
        author.walletAddress,
        input.creationFeeTxHash.trim(),
        creatorDepositUsdc,
      )
    }

    const createdPost = await this.findPostById(post.id, profileId)
    this.logger.log(
      `Successfully created market post ${post.id} (market: ${mId}) by author ${profileId}`,
    )

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    return {
      post: createdPost,
      warning: this.getMarketWarning(input.question),
    }
  }

  async incrementCommentsCount(postId: string): Promise<void> {
    await this.postModel.updateOne(
      { _id: postId },
      { $inc: { commentsCount: 1 } },
    )
  }

  async refreshPostCounters(postId: string): Promise<void> {
    const [commentsCount, likesCount, resharesCount] = await Promise.all([
      this.commentModel.countDocuments({ postId }),
      this.likeModel.countDocuments({ postId }),
      this.reshareModel.countDocuments({ postId }),
    ])

    await this.postModel.updateOne(
      { _id: postId },
      { commentsCount, likesCount, resharesCount },
    )
  }
}
