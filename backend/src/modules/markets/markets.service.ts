import {
  Injectable,
  NotFoundException,
  ConflictException,
  // NotImplementedException,
  Inject,
  forwardRef,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types, /*SortOrder*/ } from "mongoose"
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
} from "./markets.model"
import { User, UserDocument } from "../users/users.model"
import { Post, PostDocument } from "../posts/posts.model"
import { PostsService, MarketResponse } from "../posts/posts.service"
import { BlockchainService } from "../blockchain/blockchain.service"
import { SocketGateway } from "../socket/socket.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { PvpService } from "../pvp/pvp.service"
import { LiquidityService } from "../liquidity/liquidity.service"

export interface DailyVotesResponse {
  votesLimit: number
  votesUsed: number
  votesRemaining: number
  date: string
}

export interface VoteResponse {
  market: MarketResponse
  dailyVotes: DailyVotesResponse
}

export interface MarketHistoryResponse {
  id: string
  marketId: string
  marketQuestion: string
  side: VoteSide
  created_at: string
  market_question?: string | null
}

export interface MarketPositionResponse {
  id: string
  market_id: string
  user_id: string
  side: VoteSide
  shares: number
  avg_price: number
  invested_usdc: number
  realized_pnl: number
  created_at: string
  updated_at: string
  market_question?: string | null
  usdc_yes_amount?: number
  usdc_no_amount?: number
  status?: string
  resolved_outcome?: string | null
  category?: string | null
}

export interface MarketTradeResponse {
  id: string
  market_id: string
  user_id: string
  side: VoteSide
  action: string
  shares: number
  price: number
  amount_usdc: number
  fee_usdc: number
  gross_usdc: number
  tx_hash: string | null
  created_at: string
  market_question?: string | null
}

@Injectable()
export class MarketsService implements OnModuleInit {
  private readonly logger = new Logger(MarketsService.name)

  async onModuleInit() {
    try {
      const result = await this.marketModel.updateMany(
        { status: "open_for_votes" },
        { $set: { status: "qualified" } },
      )
      if (result.modifiedCount > 0) {
        this.logger.log(
          `Successfully migrated ${result.modifiedCount} 'open_for_votes' markets to 'qualified' status.`,
        )
      }
    } catch (err) {
      this.logger.error(
        `Failed to migrate legacy markets status: ${err.message}`,
      )
    }
  }

  constructor(
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(DailyVoteUsage.name)
    private dailyVoteUsageModel: Model<DailyVoteUsageDocument>,
    @InjectModel(MarketPosition.name)
    private marketPositionModel: Model<MarketPositionDocument>,
    @InjectModel(MarketTrade.name)
    private marketTradeModel: Model<MarketTradeDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
    private readonly blockchainService: BlockchainService,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly pvpService: PvpService,
    private readonly liquidityService: LiquidityService,
  ) { }

  private todayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10)
  }

  private serializeDailyUsage(
    usage: DailyVoteUsageDocument | null,
    date = this.todayKey(),
  ): DailyVotesResponse {
    const votesLimit = usage?.votesLimit ?? 10
    const votesUsed = usage?.votesUsed ?? 0
    return {
      votesLimit,
      votesUsed,
      votesRemaining: Math.max(0, votesLimit - votesUsed),
      date,
    }
  }

  private isDuplicateKeyError(error: any): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
  }

  private serializePosition(
    position: MarketPositionDocument,
  ): MarketPositionResponse {
    const createdAt = position.createdAt
      ? new Date(position.createdAt).toISOString()
      : new Date().toISOString()
    const updatedAt = position.updatedAt
      ? new Date(position.updatedAt).toISOString()
      : new Date().toISOString()

    const m = position.marketId as any
    const market_question =
      m && typeof m === "object" && "question" in m ? m.question : null
    const usdc_yes_amount =
      m && typeof m === "object" && "usdcYesAmount" in m ? m.usdcYesAmount : 0
    const usdc_no_amount =
      m && typeof m === "object" && "usdcNoAmount" in m ? m.usdcNoAmount : 0
    const status = m && typeof m === "object" && "status" in m ? m.status : null
    const resolved_outcome =
      m && typeof m === "object" && "resolvedOutcome" in m
        ? m.resolvedOutcome
        : null

    const category =
      m && typeof m === "object" && "category" in m ? m.category : null

    return {
      id: position.id || (position as any)._id?.toString(),
      market_id:
        m && typeof m === "object" && "_id" in m
          ? m._id.toString()
          : position.marketId
            ? position.marketId.toString()
            : "",
      user_id: position.userId.toString(),
      side: position.side,
      shares: position.shares,
      avg_price: position.avgPrice,
      invested_usdc: position.investedUsdc,
      realized_pnl: position.realizedPnl,
      created_at: createdAt,
      updated_at: updatedAt,
      market_question,
      usdc_yes_amount,
      usdc_no_amount,
      status,
      resolved_outcome,
      category,
    }
  }

  private serializeTrade(trade: MarketTradeDocument): MarketTradeResponse {
    const createdAt = trade.createdAt
      ? new Date(trade.createdAt).toISOString()
      : new Date().toISOString()

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
    }
  }

  async getDailyVotes(
    userId: string,
    date = this.todayKey(),
  ): Promise<DailyVotesResponse> {
    const usage = await this.dailyVoteUsageModel.findOne({
      userId: new Types.ObjectId(userId),
      date,
    })
    return this.serializeDailyUsage(usage, date)
  }

  private async getOrCreateDailyUsage(
    userId: string,
    date = this.todayKey(),
  ): Promise<DailyVoteUsageDocument> {
    return this.dailyVoteUsageModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), date },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          date,
          votesUsed: 0,
          votesLimit: 10,
        },
      },
      { upsert: true, new: true, runValidators: true },
    )
  }

  private async reserveDailyVote(
    userId: string,
    date = this.todayKey(),
  ): Promise<DailyVoteUsageDocument> {
    await this.getOrCreateDailyUsage(userId, date)

    const usage = await this.dailyVoteUsageModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        date,
        $expr: { $lt: ["$votesUsed", "$votesLimit"] },
      },
      { $inc: { votesUsed: 1 } },
      { new: true, runValidators: true },
    )

    if (!usage) {
      throw new ConflictException(
        "You have used all 10 votes today. Votes reset tomorrow.",
      )
    }

    return usage
  }

  private async releaseDailyVote(
    userId: string,
    date = this.todayKey(),
  ): Promise<void> {
    await this.dailyVoteUsageModel.updateOne(
      { userId: new Types.ObjectId(userId), date, votesUsed: { $gt: 0 } },
      { $inc: { votesUsed: -1 } },
    )
  }

  async castFreeVote(
    marketId: string,
    userId: string,
    side: VoteSide,
  ): Promise<VoteResponse> {
    const [market, userExists] = await Promise.all([
      this.marketModel.findById(marketId),
      this.userModel.exists({ _id: userId }),
    ])

    if (!market) {
      throw new NotFoundException("Market not found.")
    }
    if (!userExists) {
      throw new NotFoundException("User not found.")
    }
    if (
      !["open_for_votes", "qualified", "funding_pool", "tradable"].includes(
        market.status,
      )
    ) {
      throw new ConflictException("This market is not open for free voting.")
    }

    const existingVote = await this.voteModel.exists({
      marketId: new Types.ObjectId(marketId),
      userId: new Types.ObjectId(userId),
      voteType: "free",
    })
    if (existingVote) {
      throw new ConflictException("You have already voted on this market.")
    }

    const usageDate = this.todayKey()
    const usage = await this.reserveDailyVote(userId, usageDate)
    try {
      await this.voteModel.create({
        marketId: new Types.ObjectId(marketId),
        userId: new Types.ObjectId(userId),
        side,
        voteType: "free",
      })
    } catch (error) {
      await this.releaseDailyVote(userId, usageDate)
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("You have already voted on this market.")
      }
      throw error
    }

    const [freeYesVotes, freeNoVotes, uniqueVotersCount] = await Promise.all([
      this.voteModel.countDocuments({
        marketId: new Types.ObjectId(marketId),
        voteType: "free",
        side: "YES",
      }),
      this.voteModel.countDocuments({
        marketId: new Types.ObjectId(marketId),
        voteType: "free",
        side: "NO",
      }),
      this.voteModel
        .distinct("userId", {
          marketId: new Types.ObjectId(marketId),
          voteType: "free",
        })
        .then((ids) => ids.length),
    ])
    const totalFreeVotes = freeYesVotes + freeNoVotes

    const updatedMarket = await this.marketModel.findByIdAndUpdate(
      marketId,
      {
        freeYesVotes,
        freeNoVotes,
        totalFreeVotes,
        uniqueVotersCount,
      },
      { new: true, runValidators: true },
    )

    this.logger.log(
      `Free vote casted on market ${marketId} by user ${userId}. Side: ${side}`,
    )

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {
      marketId,
    })
    this.socketGateway.broadcastToRoom(
      `post:${market.postId}`,
      "post-updated",
      { postId: market.postId.toString() },
    )

    return {
      market: this.postsService.serializeMarket(updatedMarket!),
      dailyVotes: this.serializeDailyUsage(usage, usageDate),
    }
  }

  async fetchMarkets(filters: {
    status?: MarketStatus
    category?: string
    qualified?: boolean
    open_for_votes?: boolean
    trending?: boolean
    newest?: boolean
    admin?: boolean
  }): Promise<MarketResponse[]> {
    const query: Record<string, unknown> = {}
    if (filters.status) query.status = filters.status
    if (filters.category) query.category = filters.category
    if (filters.qualified) query.status = "qualified"
    if (filters.open_for_votes) query.status = "open_for_votes"

    if (filters.admin) {
      query.$or = [
        {
          marketType: { $in: ["binary", "parent"] },
          category: { $ne: "pvp" },
        },
        {
          marketType: "child",
          category: "pvp",
        },
      ]
    } else {
      // We only want to show binary/parent markets, NOT child markets!
      query.marketType = { $ne: "child" }
    }

    const sort: Record<string, any> = filters.trending
      ? { totalFreeVotes: -1, uniqueVotersCount: -1, createdAt: -1 }
      : { createdAt: filters.newest === false ? 1 : -1 }

    const markets = await this.marketModel.find(query).sort(sort).limit(100)

    // Fetch child markets for any parent markets in the list
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

    return markets.map((m) => {
      const children = childMarketsMap.get(m.id) || []
      return this.postsService.serializeMarket(m, children)
    })
  }

  async fetchMarketDetail(marketId: string, viewerProfileId?: string) {
    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }

    return this.postsService.findPostById(
      market.postId.toString(),
      viewerProfileId,
    )
  }

  async approveMarketForTrading(marketId: string): Promise<MarketResponse> {
    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }
    if (market.status === "funding_pool") {
      return this.postsService.serializeMarket(market)
    }
    if (market.status !== "qualified") {
      throw new ConflictException(
        "Only qualified markets can be approved for USDC trading.",
      )
    }

    // Look up creator wallet address
    const creator = await this.userModel.findById(market.authorId)
    if (!creator || !creator.walletAddress) {
      throw new BadRequestException(
        "Market creator does not have a linked wallet address.",
      )
    }

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const fundingDeadline =
      market.deadline < sevenDaysFromNow ? market.deadline : sevenDaysFromNow

    const deadlineUnix = Math.floor(market.deadline.getTime() / 1000)
    const fundingDeadlineUnix = Math.floor(fundingDeadline.getTime() / 1000)

    // Register market on-chain so depositPreMarketLiquidity won't revert
    try {
      if (
        market.isPythMarket &&
        market.priceFeedId &&
        market.targetPrice != null
      ) {
        await this.blockchainService.registerPythMarket(
          marketId,
          creator.walletAddress,
          deadlineUnix,
          fundingDeadlineUnix,
          market.priceFeedId,
          market.targetPrice,
          market.resolveAbove ?? true,
        )
      } else {
        await this.blockchainService.registerMarket(
          marketId,
          creator.walletAddress,
          deadlineUnix,
          fundingDeadlineUnix,
        )
      }
    } catch (error) {
      // If already registered on-chain, ignore the error and continue
      const msg = error?.message || ""
      if (!msg.includes("MarketAlreadyRegistered")) {
        throw error
      }
    }

    const updatedMarket = await this.marketModel.findByIdAndUpdate(
      marketId,
      { status: "funding_pool", fundingDeadline },
      { new: true, runValidators: true },
    )

    this.logger.log(
      `Market ${marketId} status transitioned from ${market.status} to funding_pool`,
    )

    // Emit Socket events to update UI in real-time
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {
      marketId,
    })
    this.socketGateway.broadcastToRoom(
      `post:${market.postId}`,
      "post-updated",
      { postId: market.postId.toString() },
    )

    return this.postsService.serializeMarket(updatedMarket!)
  }

  async adminDepositLiquidity(marketId: string, amount: number) {
    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }

    const txHash = await this.blockchainService.adminDepositPreMarketLiquidity(
      marketId,
      amount,
    )

    // Sync database pool state from chain
    await this.liquidityService.syncPoolFromChain(marketId)

    return {
      success: true,
      txHash,
    }
  }

  async fetchMarketPositions(
    marketId: string,
    profileId: string,
  ): Promise<MarketPositionResponse[]> {
    const user = await this.userModel.findById(profileId)
    if (user && user.walletAddress) {
      try {
        const market = await this.marketModel.findById(marketId)
        const isResolved =
          market && (market.status === "resolved" || market.resolvedOutcome)
        const winningOutcome = market?.resolvedOutcome
        const outcomes =
          market && market.outcomes && market.outcomes.length > 0
            ? market.outcomes
            : ["YES", "NO"]

        const onChain = await this.blockchainService.getUserOnChainBalances(
          marketId,
          user.walletAddress,
          outcomes,
        )

        const outcomeCount = market?.outcomeCount ?? 2
        const isMulti = outcomeCount > 2

        let normalizedWinningOutcome = winningOutcome
        if (!isMulti && winningOutcome && outcomes.length >= 2) {
          if (
            winningOutcome.toUpperCase() === outcomes[0].toUpperCase() ||
            winningOutcome.toUpperCase() === "YES"
          ) {
            normalizedWinningOutcome = "YES"
          } else if (
            winningOutcome.toUpperCase() === outcomes[1].toUpperCase() ||
            winningOutcome.toUpperCase() === "NO"
          ) {
            normalizedWinningOutcome = "NO"
          }
        }

        for (let idx = 0; idx < outcomes.length; idx++) {
          const outcome = outcomes[idx]
          const normalizedSide = isMulti ? outcome : idx === 0 ? "YES" : "NO"

          const balance = onChain[outcome] ?? 0
          const isLosing =
            isResolved && normalizedWinningOutcome !== normalizedSide

          if (!isLosing && balance > 0) {
            await this.marketPositionModel.updateOne(
              {
                marketId: new Types.ObjectId(marketId),
                userId: new Types.ObjectId(profileId),
                side: normalizedSide,
              },
              {
                $set: {
                  shares: balance,
                  isArchived: false,
                },
                $setOnInsert: {
                  avgPrice: 0.5,
                  investedUsdc: balance * 0.5,
                  realizedPnl: 0,
                },
              },
              { upsert: true },
            )
          } else {
            await this.marketPositionModel.updateOne(
              {
                marketId: new Types.ObjectId(marketId),
                userId: new Types.ObjectId(profileId),
                side: normalizedSide,
              },
              {
                $set: {
                  shares: 0,
                  isArchived: true,
                },
              },
            )
          }
        }
      } catch (err) {
        // Fallback to DB if RPC call fails
      }
    }

    const positions = await this.marketPositionModel
      .find({
        marketId: new Types.ObjectId(marketId),
        userId: new Types.ObjectId(profileId),
        $or: [{ shares: { $gt: 0 } }, { isArchived: true }],
      })
      .sort({ updatedAt: -1 })

    return positions.map((p) => this.serializePosition(p))
  }

  async fetchMarketTrades(marketId: string): Promise<MarketTradeResponse[]> {
    const trades = await this.marketTradeModel
      .find({
        marketId: new Types.ObjectId(marketId),
      })
      .sort({ createdAt: -1 })
      .limit(25)

    return trades.map((t) => this.serializeTrade(t))
  }

  async executeMarketTrade(marketId: string, dto: any): Promise<void> {
    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }
    const user = await this.userModel.findById(dto.profileId)
    if (!user) {
      throw new NotFoundException("User not found.")
    }

    if (market.status !== "tradable") {
      throw new BadRequestException("Trading is not active for this market.")
    }

    const lockTimeLimit = market.lockTime || market.deadline
    if (new Date() >= lockTimeLimit) {
      throw new BadRequestException(
        "Trading deadline/lock time has passed for this market.",
      )
    }

    // Verify txHash if provided
    if (dto.txHash) {
      await this.blockchainService.getTransactionReceipt(
        dto.txHash as `0x${string}`,
      )
    }

    const amountUsdc = dto.amount
    const grossUsdc = dto.grossAmount || dto.amount
    const feeUsdc = dto.feeAmount || 0

    // Create MarketTrade record
    const shares = dto.grossAmount || dto.amount
    const price = amountUsdc / (shares || 1)

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
    })

    // Update or create Position
    let position = await this.marketPositionModel.findOne({
      marketId: new Types.ObjectId(marketId),
      userId: new Types.ObjectId(dto.profileId),
      side: dto.side,
    })

    if (dto.action === "BUY") {
      if (position) {
        position.shares += shares
        position.investedUsdc += amountUsdc
        position.avgPrice = position.investedUsdc / (position.shares || 1)
        position.isArchived = false
        await position.save()
      } else {
        await this.marketPositionModel.create({
          marketId: new Types.ObjectId(marketId),
          userId: new Types.ObjectId(dto.profileId),
          side: dto.side,
          shares,
          avgPrice: price,
          investedUsdc: amountUsdc,
          realizedPnl: 0,
        })
      }
    } else if (dto.action === "SELL") {
      if (!position) {
        throw new BadRequestException("No position to sell.")
      }
      //const oldShares = position.shares;
      position.shares = Math.max(0, position.shares - shares)

      const exitPrice = price
      const avgPrice = position.avgPrice
      const pnl = (exitPrice - avgPrice) * shares

      position.realizedPnl += pnl
      position.investedUsdc = Math.max(
        0,
        position.investedUsdc - avgPrice * shares,
      )

      if (position.shares === 0) {
        position.isArchived = true
      }
      await position.save()
    }

    // Sync market balances and prices from chain
    await this.syncMarketPrices(marketId)

    // Clear PvP position sync cache since the user just executed a trade
    this.pvpService.clearSyncCache(dto.profileId)

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {
      marketId,
    })
    this.socketGateway.broadcastToRoom(
      `post:${market.postId}`,
      "post-updated",
      { postId: market.postId.toString() },
    )
    this.socketGateway.broadcastToRoom(
      `user:${dto.profileId}`,
      "user-updated",
      {},
    )
  }

  async syncMarketPrices(marketId: string): Promise<void> {
    try {
      const market = await this.marketModel.findById(marketId)
      if (!market) return

      const balances = await this.blockchainService.readPoolBalances(
        marketId as `0x${string}`,
      )

      const updateData: any = {
        liquidity: Number(balances.totalDeposited) / 1e6,
      }

      const outcomeCount = market.outcomeCount ?? 2
      if (outcomeCount > 2) {
        try {
          const rawBalances =
            await this.blockchainService.readOutcomeBalances(marketId)
          const outcomeBalances = rawBalances.map((b) => Number(b) / 1e6)
          updateData.outcomeBalances = outcomeBalances

          // Calculate outcome prices: p_j = (1/x_j) / sum(1/x_i)
          const hasZero = outcomeBalances.some((b) => b === 0)
          if (hasZero) {
            updateData.outcomePrices = new Array(outcomeCount).fill(
              1 / outcomeCount,
            )
          } else {
            const invSum = outcomeBalances.reduce((sum, b) => sum + 1 / b, 0)
            updateData.outcomePrices = outcomeBalances.map(
              (b) => 1 / b / invSum,
            )
          }

          updateData.usdcYesAmount = outcomeBalances[0] || 0
          updateData.usdcNoAmount = outcomeBalances[1] || 0
        } catch (e) {
          this.logger.warn(
            `Failed to read multi-outcome balances for ${marketId}: ${e.message}`,
          )
          const yesBal = Number(balances.yesBalance) / 1e6
          const noBal = Number(balances.noBalance) / 1e6
          updateData.outcomeBalances = [yesBal, noBal]
          updateData.outcomePrices = [0.5, 0.5]
        }
      } else {
        const yesBal = Number(balances.yesBalance) / 1e6
        const noBal = Number(balances.noBalance) / 1e6
        updateData.usdcYesAmount = yesBal
        updateData.usdcNoAmount = noBal
        updateData.outcomeBalances = [yesBal, noBal]

        const total = yesBal + noBal
        if (total === 0) {
          updateData.outcomePrices = [0.5, 0.5]
        } else {
          const yesPrice = noBal / total
          updateData.outcomePrices = [yesPrice, 1 - yesPrice]
        }
      }

      await this.marketModel.findByIdAndUpdate(marketId, updateData)
    } catch (e) {
      this.logger.warn(
        `Failed to sync market prices for ${marketId}: ${e.message}`,
      )
    }
  }

  async resolveMarket(
    marketId: string,
    winningOutcome: string,
    txHash: string | undefined,
    adminAddress: string,
  ): Promise<MarketResponse> {
    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }

    let finalTxHash = txHash?.trim() || null

    const outcomeCount = market.outcomeCount ?? 2
    let winningIndex = -1

    // Attempt to match by index from the outcomes list first (for both binary and multi-outcome)
    if (market.outcomes && market.outcomes.length > 0) {
      winningIndex = market.outcomes.findIndex(
        (o) => o.toLowerCase().trim() === winningOutcome.toLowerCase().trim(),
      )
    }

    if (outcomeCount > 2) {
      if (winningIndex === -1 && /^\d+$/.test(winningOutcome)) {
        winningIndex = parseInt(winningOutcome, 10)
      }
      if (winningIndex === -1) {
        winningIndex = 0 // fallback
      }
    } else {
      if (winningIndex === -1) {
        // Fallback: Check if winningOutcome is YES/yes (index 0) or NO/no (index 1)
        winningIndex =
          winningOutcome === "YES" || winningOutcome.toLowerCase() === "yes"
            ? 0
            : 1
      }
    }

    if (finalTxHash) {
      // Verify transaction receipt if provided
      await this.blockchainService.getTransactionReceipt(
        finalTxHash as `0x${string}`,
      )
    } else {
      // No txHash provided: Backend executes the transaction on-chain on behalf of the admin!
      if (market.marketType !== "parent") {
        try {
          const isDisputed = market.disputed || false
          if (isDisputed) {
            finalTxHash = await this.blockchainService.resolveDisputedMarket(
              marketId,
              winningIndex,
            )
          } else {
            if (outcomeCount > 2) {
              finalTxHash = await this.blockchainService.resolveMarketOutcome(
                marketId,
                winningIndex,
              )
            } else {
              const winningIsYes = winningIndex === 0
              finalTxHash = await this.blockchainService.resolveMarket(
                marketId,
                winningIsYes,
              )
            }
          }
          if (finalTxHash) {
            this.logger.log(
              `On-chain resolution executed by backend for market ${marketId}: tx ${finalTxHash}`,
            )
          }
        } catch (error) {
          this.logger.error(
            `Failed to execute on-chain resolution directly for market ${marketId}: ${error.message}`,
          )
          throw new BadRequestException(
            `Failed to resolve market on-chain: ${error.message}`,
          )
        }
      }
    }

    const oldStatus = market.status
    market.status = "resolved"
    market.resolvedByAdmin = adminAddress

    if (outcomeCount > 2) {
      if (winningIndex >= 0 && winningIndex < outcomeCount) {
        market.winningOutcomeIndex = winningIndex
        market.resolvedOutcome = market.outcomes[winningIndex] as any
      } else {
        market.winningOutcomeIndex = 0
        market.resolvedOutcome = (market.outcomes[0] || winningOutcome) as any
      }
    } else {
      market.resolvedOutcome = winningOutcome as any
      market.winningOutcomeIndex = winningIndex
    }

    await market.save()

    // If this is a PvP parent market, cascade resolution to all child markets
    if (market.marketType === "parent") {
      await this.pvpService.matchRemainingTicketsWithBot(marketId)

      const childMarkets = await this.marketModel.find({
        parentMarketId: market._id,
        status: { $ne: "resolved" },
      })

      this.logger.log(
        `Cascading resolution from parent ${marketId} to ${childMarkets.length} child markets (outcome: ${winningOutcome})`,
      )

      for (const child of childMarkets) {
        if (child.outcomeCount > 2) {
          // Multi-outcome child market
          const winningIndex = child.outcomes.findIndex(
            (o) =>
              o.toLowerCase().trim() === winningOutcome.toLowerCase().trim(),
          )
          if (winningIndex >= 0) {
            // Resolve child market on-chain FIRST
            try {
              await this.blockchainService.resolveMarketOutcome(
                child._id.toString(),
                winningIndex,
              )
              this.logger.log(
                `Successfully resolved multi-outcome child market ${child._id} on-chain to index ${winningIndex}`,
              )

              // Only save to DB if on-chain succeeded!
              child.status = "resolved"
              child.resolvedOutcome = child.outcomes[winningIndex]
              child.winningOutcomeIndex = winningIndex
              child.resolvedByAdmin = adminAddress
              await child.save()

              // Trigger PvP match resolution for each child market
              await this.pvpService.resolvePvpMatchesForMarket(
                child._id.toString(),
                child.outcomes[winningIndex],
              )

              this.logger.log(
                `Resolved multi-outcome child market ${child._id} (${child.optionName || child.question}) -> ${child.outcomes[winningIndex]}`,
              )

              // Emit socket events for each child market
              this.socketGateway.broadcastToRoom(
                `market:${child._id.toString()}`,
                "market-updated",
                { marketId: child._id.toString() },
              )
            } catch (err) {
              this.logger.error(
                `Failed to resolve multi-outcome child market ${child._id} on-chain: ${err.message}`,
              )
              throw new BadRequestException(
                `Failed to resolve child market ${child.optionName || child.question} on-chain: ${err.message}`,
              )
            }
          }
        } else {
          // Binary child market
          const isYesMatch =
            child.outcomes[0]?.toLowerCase().trim() ===
            winningOutcome.toLowerCase().trim()
          const isNoMatch =
            child.outcomes[1]?.toLowerCase().trim() ===
            winningOutcome.toLowerCase().trim()

          if (isYesMatch || isNoMatch) {
            const childResolvedOutcome = isYesMatch ? "YES" : "NO"

            // Resolve child market on-chain FIRST
            try {
              const winningIsYes = isYesMatch
              await this.blockchainService.resolveMarket(
                child._id.toString(),
                winningIsYes,
              )
              this.logger.log(
                `Successfully resolved binary child market ${child._id} on-chain (winningIsYes: ${winningIsYes})`,
              )

              // Only save to DB if on-chain succeeded!
              child.status = "resolved"
              child.resolvedOutcome = childResolvedOutcome
              child.winningOutcomeIndex = isYesMatch ? 0 : 1
              child.resolvedByAdmin = adminAddress
              await child.save()

              // Trigger PvP match resolution for each child market
              await this.pvpService.resolvePvpMatchesForMarket(
                child._id.toString(),
                childResolvedOutcome,
              )

              this.logger.log(
                `Resolved binary child market ${child._id} (${child.optionName || child.question}) -> ${childResolvedOutcome}`,
              )

              // Emit socket events for each child market
              this.socketGateway.broadcastToRoom(
                `market:${child._id.toString()}`,
                "market-updated",
                { marketId: child._id.toString() },
              )
            } catch (err) {
              this.logger.error(
                `Failed to resolve binary child market ${child._id} on-chain: ${err.message}`,
              )
              throw new BadRequestException(
                `Failed to resolve child market ${child.optionName || child.question} on-chain: ${err.message}`,
              )
            }
          }
        }
      }
    } else {
      // For non-parent markets, trigger PvP match resolution directly
      await this.pvpService.resolvePvpMatchesForMarket(marketId, winningOutcome)
    }

    this.logger.log(
      `Market ${marketId} status transitioned from ${oldStatus} to resolved (outcome: ${winningOutcome}, by admin: ${adminAddress})`,
    )

    // Trigger Notification for Creator
    try {
      const recipientId = market.authorId.toString()
      const adminUser = await this.userModel.findOne({
        walletAddress: adminAddress.trim().toLowerCase(),
      })
      if (adminUser) {
        await this.notificationsService.createNotification(
          recipientId,
          adminUser.id,
          "settlement",
          "Market resolved",
          `Your market "${market.question}" has been resolved to ${winningOutcome}.`,
          market.id || (market as any)._id?.toString(),
        )
        this.logger.log(
          `Notification sent to creator ${recipientId} for resolution of market ${marketId} by admin ${adminUser.id}`,
        )
      } else {
        this.logger.warn(
          `Could not send resolution notification: no user found for admin wallet ${adminAddress}`,
        )
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send resolution notification for market ${marketId}: ${err.message}`,
      )
    }

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {
      marketId,
    })
    this.socketGateway.broadcastToRoom(
      `post:${market.postId}`,
      "post-updated",
      { postId: market.postId.toString() },
    )

    return this.postsService.serializeMarket(market)
  }

  async disputeMarket(
    marketId: string,
    adminAddress: string,
  ): Promise<MarketResponse> {
    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }

    try {
      // Execute on-chain dispute
      const txHash = await this.blockchainService.disputeResolution(marketId)
      await this.blockchainService.getTransactionReceipt(
        txHash as `0x${string}`,
      )

      // Update DB
      market.disputed = true
      market.proposalDisputer = adminAddress
      market.status = "resolving"
      await market.save()

      this.logger.log(
        `Market ${marketId} disputed on-chain by admin. tx: ${txHash}`,
      )
    } catch (error) {
      this.logger.error(
        `Failed to dispute market ${marketId}: ${error.message}`,
      )
      throw new BadRequestException(
        `Failed to dispute market on-chain: ${error.message}`,
      )
    }

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    this.socketGateway.broadcastToRoom(`market:${marketId}`, "market-updated", {
      marketId,
    })

    return this.postsService.serializeMarket(market)
  }

  async devQualify(marketId: string): Promise<MarketResponse> {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException(
        "Dev-qualify is not available in production.",
      )
    }

    const market = await this.marketModel.findById(marketId)
    if (!market) {
      throw new NotFoundException("Market not found.")
    }
    if (market.status !== "open_for_votes") {
      throw new ConflictException(
        `Market is already in '${market.status}' status.`,
      )
    }

    const oldStatus = market.status
    market.status = "qualified"
    market.totalFreeVotes = 30
    market.uniqueVotersCount = 30
    market.freeYesVotes = 30
    market.freeNoVotes = 0
    await market.save()
    this.logger.log(
      `Market ${marketId} status transitioned from ${oldStatus} to qualified via devQualify`,
    )

    if (
      market.marketType === "parent" ||
      (market as any).market_type === "parent"
    ) {
      await this.marketModel.updateMany(
        { parentMarketId: market._id },
        {
          $set: {
            status: "qualified",
            totalFreeVotes: 30,
            uniqueVotersCount: 30,
            freeYesVotes: 30,
            freeNoVotes: 0,
          },
        },
      )
      this.logger.log(
        `Qualifying child markets for parent market ${marketId} via devQualify`,
      )
    }

    return this.postsService.serializeMarket(market)
  }

  async fetchAllUserPositions(
    userId: string,
  ): Promise<MarketPositionResponse[]> {
    const positions = await this.marketPositionModel
      .find({
        userId: new Types.ObjectId(userId),
        $or: [{ shares: { $gt: 0 } }, { isArchived: true }],
      })
      .populate("marketId")
      .sort({ updatedAt: -1 })

    return positions.map((p) => this.serializePosition(p))
  }

  async getTopPredictors(limit = 10): Promise<any[]> {
    const pipeline: any[] = [
      {
        $lookup: {
          from: "markets",
          localField: "marketId",
          foreignField: "_id",
          as: "market",
        },
      },
      { $unwind: "$market" },
      {
        $match: {
          "market.status": "resolved",
          "market.resolvedOutcome": { $ne: null },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalPredictions: { $sum: 1 },
          wonPredictions: {
            $sum: {
              $cond: [{ $eq: ["$side", "$market.resolvedOutcome"] }, 1, 0],
            },
          },
        },
      },
      {
        $addFields: {
          accuracy: {
            $cond: [
              { $gt: ["$totalPredictions", 0] },
              {
                $multiply: [
                  { $divide: ["$wonPredictions", "$totalPredictions"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $sort: {
          accuracy: -1,
          totalPredictions: -1,
        },
      },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ]

    const result = await this.marketPositionModel.aggregate(pipeline)

    return result.map((r) => {
      const user = r.user
      return {
        id: user._id.toString(),
        wallet_address: user.walletAddress,
        walletAddress: user.walletAddress,
        username: user.username,
        display_name: user.displayName,
        displayName: user.displayName,
        avatar_url: user.avatarUrl,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        signalPoints: user.signalPoints,
        arenaXp: user.arenaXp,
        doubleBoostRemaining: user.doubleBoostRemaining,
        hasWonFirstPvpDuel: user.hasWonFirstPvpDuel,
        pvpMatchesWonCount: user.pvpMatchesWonCount,
        pvpMatchesLostCount: user.pvpMatchesLostCount,
        pvpMatchesDrawnCount: user.pvpMatchesDrawnCount,
        created_at: user.createdAt?.toISOString(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
        isOnboarded: user.isOnboarded,
        referredById: user.referredById?.toString(),
        accuracy: Math.round(r.accuracy),
        totalPredictions: r.totalPredictions,
      }
    })
  }

  async fetchAllUserTrades(userId: string): Promise<MarketTradeResponse[]> {
    const trades = await this.marketTradeModel
      .find({
        userId: new Types.ObjectId(userId),
      })
      .populate("marketId")
      .sort({ createdAt: -1 })

    return trades.map((t) => {
      const serialized = this.serializeTrade(t)
      const m = t.marketId as any
      const market_question =
        m && typeof m === "object" && "question" in m ? m.question : null
      return {
        ...serialized,
        market_question,
      }
    })
  }
}
