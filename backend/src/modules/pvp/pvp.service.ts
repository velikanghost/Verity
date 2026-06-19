import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import {
  PvpTicket,
  PvpTicketDocument,
  PvpMatch,
  PvpMatchDocument,
} from "./pvp.model"
import { User, UserDocument } from "../users/users.model"
import {
  Market,
  MarketDocument,
  MarketPosition,
  MarketPositionDocument,
  MarketTrade,
  MarketTradeDocument,
} from "../markets/markets.model"
import { Post, PostDocument } from "../posts/posts.model"
import { SocketGateway } from "../socket/socket.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { CreatePvpEventDto, SubmitTicketDto } from "./pvp.dto"
import { BlockchainService } from "../blockchain/blockchain.service"
import { LiquidityService } from "../liquidity/liquidity.service"
import { calculatePvpResultXp, calculatePvpScore } from "./pvp-scoring"
import type { PvpResult } from "./pvp-scoring"
import { AgentService } from "../agent/agent.service"
import { ConfigService } from "@nestjs/config"

export const BOT_PROFILES = [
  { username: "alex_g", displayName: "Alex Green" },
  { username: "charlie_k", displayName: "Charlie King" },
  { username: "sam_smith", displayName: "Sam Smith" },
  { username: "jordan_d", displayName: "Jordan Davis" },
  { username: "taylor_m", displayName: "Taylor Miller" },
  { username: "morgan_p", displayName: "Morgan Perry" },
  { username: "casey_r", displayName: "Casey Reed" },
  { username: "jamie_b", displayName: "Jamie Bell" },
  { username: "skyler_w", displayName: "Skyler White" },
  { username: "riley_h", displayName: "Riley Hall" },
  { username: "rowan_f", displayName: "Rowan Foster" },
  { username: "harper_c", displayName: "Harper Cole" },
  { username: "quinn_l", displayName: "Quinn Lane" },
  { username: "finley_t", displayName: "Finley Taylor" },
  { username: "avery_s", displayName: "Avery Stone" },
  { username: "reese_v", displayName: "Reese Vance" },
  { username: "hayden_p", displayName: "Hayden Pratt" },
  { username: "dylan_y", displayName: "Dylan Yates" },
  { username: "parker_n", displayName: "Parker Nash" },
  { username: "logan_x", displayName: "Logan Cruz" },
]

export function determineOptionGroup(
  optionName: string,
  teamA: string,
  teamB: string,
): string {
  const name = optionName.toLowerCase().trim()
  const tA = teamA.toLowerCase().trim()
  const tB = teamB.toLowerCase().trim()

  if (
    name.includes("wins the match") ||
    name.includes("ends in a draw") ||
    name === `${tA} wins` ||
    name === `${tB} wins` ||
    name === "draw"
  ) {
    return "major"
  }

  if (
    name.includes("scores first goal") ||
    name.includes("first goal") ||
    name.includes("scores first") ||
    name === "no goal in the match" ||
    name === "no goal"
  ) {
    return "first_goal"
  }

  if (name.includes("leads at halftime") || name.includes("halftime")) {
    return "halftime_leader"
  }

  if (name.includes("keeps a clean sheet") || name.includes("clean sheet")) {
    return "clean_sheet"
  }

  if (
    name.includes("commits more fouls") ||
    name.includes("fouls") ||
    name.includes("foul")
  ) {
    return "fouls_leader"
  }

  if (name.includes("red card") || name.includes("red cards")) {
    return "red_card"
  }

  if (
    name.includes("yellow card") ||
    name.includes("yellow cards") ||
    name.includes("card") ||
    name.includes("cards")
  ) {
    return "yellow_cards"
  }

  if (name.includes("corner") || name.includes("corners")) {
    return "corners"
  }

  if (name.includes("goals") || name.includes("goal")) {
    return "goals"
  }

  if (
    name.includes("both teams to score") ||
    name.includes("both teams score") ||
    name.includes("btts")
  ) {
    return "btts"
  }

  if (name.includes("offsides") || name.includes("offside")) {
    return "offsides"
  }

  return `unique_${optionName.replace(/\s+/g, "_").toLowerCase()}`
}

@Injectable()
export class PvpService {
  private readonly logger = new Logger(PvpService.name)
  private readonly lastSyncMap = new Map<string, number>()

  clearSyncCache(userId: string, parentMarketId?: string) {
    if (parentMarketId) {
      this.lastSyncMap.delete(`${userId}:${parentMarketId}`)
    } else {
      for (const key of this.lastSyncMap.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.lastSyncMap.delete(key)
        }
      }
    }
  }

  constructor(
    @InjectModel(PvpTicket.name)
    private pvpTicketModel: Model<PvpTicketDocument>,
    @InjectModel(PvpMatch.name) private pvpMatchModel: Model<PvpMatchDocument>,
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(MarketPosition.name)
    private marketPositionModel: Model<MarketPositionDocument>,
    @InjectModel(MarketTrade.name)
    private marketTradeModel: Model<MarketTradeDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly blockchainService: BlockchainService,
    private readonly liquidityService: LiquidityService,
    private readonly agentService: AgentService,
    private readonly configService: ConfigService,
  ) {}

  async createPvpEvent(adminId: string, dto: CreatePvpEventDto) {
    const admin = await this.userModel.findById(adminId)
    if (!admin || admin.role !== "admin") {
      throw new ForbiddenException("Only admins can create PvP events.")
    }

    // Parse teamA and teamB from the question (e.g. "Mexico vs Southafrica")
    let teamA = "YES"
    let teamB = "NO"
    const question = dto.question.trim()
    const vsMatch = question.match(/(.+?)\s+vs\.?\s+(.+)/i)
    if (vsMatch) {
      teamA = vsMatch[1].trim()
      teamB = vsMatch[2].trim()
    } else {
      const dashMatch = question.match(/(.+?)\s+-\s+(.+)/)
      if (dashMatch) {
        teamA = dashMatch[1].trim()
        teamB = dashMatch[2].trim()
      }
    }

    const adminWalletAddress =
      this.blockchainService.getAdminAddress() || admin.walletAddress || ""
    if (!adminWalletAddress) {
      throw new BadRequestException(
        "Admin wallet address is not configured/available.",
      )
    }

    let post: PostDocument | null = null
    let parentMarket: MarketDocument | null = null
    const childMarketIds: Types.ObjectId[] = []

    try {
      // 1. Create Post
      post = await this.postModel.create({
        authorId: new Types.ObjectId(adminId),
        type: "market",
        content: dto.question.trim(),
      })

      // 2. Create Parent Market
      const lockTime = dto.lockTime
        ? new Date(dto.lockTime)
        : new Date(dto.deadline)
      parentMarket = await this.marketModel.create({
        postId: post._id,
        authorId: new Types.ObjectId(adminId),
        question: dto.question.trim(),
        category: "pvp",
        deadline: new Date(dto.deadline),
        lockTime,
        resolutionSource: dto.resolutionSource.trim(),
        yesCondition: teamA,
        noCondition: teamB,
        status: "tradable",
        marketType: "parent",
      })

      // 3. Create Child Markets and Register/Fund them on-chain
      const childMarkets: MarketDocument[] = []
      const deadlineUnix = Math.floor(new Date(dto.deadline).getTime() / 1000)
      const now = new Date()
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const fundingDeadline =
        new Date(dto.deadline) < sevenDaysFromNow
          ? new Date(dto.deadline)
          : sevenDaysFromNow
      const fundingDeadlineUnix = Math.floor(fundingDeadline.getTime() / 1000)

      let optionGroupsMap: Record<string, string> = {}
      try {
        optionGroupsMap = await this.agentService.categorizeOptions(
          dto.question,
          dto.options,
        )
      } catch (err) {
        this.logger.error(
          `Failed to categorize options with AI: ${err.message}`,
        )
      }

      // Map option groups to their clean names (and make sure match_winner/moneyline becomes major)
      const cleanGroupsMap: Record<string, string> = {}
      for (const [opt, grp] of Object.entries(optionGroupsMap)) {
        cleanGroupsMap[opt] =
          grp === "match_winner" || grp === "moneyline" ? "major" : grp
      }

      const groups: Record<string, string[]> = {}
      for (let i = 0; i < dto.options.length; i++) {
        const optionName = dto.options[i]
        let optionGroup = determineOptionGroup(optionName, teamA, teamB)
        if (optionGroup.startsWith("unique_")) {
          // If our deterministic check did not find a standard group, fall back to AI categorization
          optionGroup = cleanGroupsMap[optionName] || optionGroup
        }
        if (optionGroup === "match_winner" || optionGroup === "moneyline") {
          optionGroup = "major"
        }
        if (!groups[optionGroup]) {
          groups[optionGroup] = []
        }
        groups[optionGroup].push(optionName)
      }

      // We will loop over each option group to create one child market per group!
      for (const [optionGroup, groupOptions] of Object.entries(groups)) {
        const outcomeCount = groupOptions.length === 1 ? 2 : groupOptions.length

        // Formulate question and optionName
        let questionSuffix = ""
        let optionName = ""
        if (optionGroup === "major") {
          questionSuffix = "Major"
          optionName = "Major"
        } else if (optionGroup === "spread") {
          questionSuffix = "Spread"
          optionName = "Spread"
        } else if (optionGroup === "totals") {
          questionSuffix = "Totals"
          optionName = "Totals"
        } else if (optionGroup === "btts") {
          questionSuffix = "BTTS"
          optionName = "BTTS"
        } else if (optionGroup === "offsides") {
          questionSuffix = "Offsides"
          optionName = "Offsides"
        } else {
          const capitalized = optionGroup
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
          questionSuffix = capitalized
          optionName = capitalized
        }

        // Determine handicap if applicable
        let handicap: number | null = null
        if (
          optionGroup === "spread" ||
          optionGroup === "totals" ||
          optionGroup === "offsides" ||
          optionGroup === "yellow_cards" ||
          optionGroup === "cards"
        ) {
          // Try to extract from the first option containing a number
          for (const opt of groupOptions) {
            const numMatch = opt.match(/([+-]?\d+(?:\.\d+)?)/)
            if (numMatch) {
              handicap = Math.abs(parseFloat(numMatch[1]))
              break
            }
          }
        }

        // Generate clean outcomes (e.g. for Major, draw or win team names)
        const outcomes =
          groupOptions.length === 1
            ? [groupOptions[0].trim(), "NO"]
            : groupOptions.map((opt) => opt.trim())

        const childMarketId = new Types.ObjectId()
        childMarketIds.push(childMarketId)

        const child = await this.marketModel.create({
          _id: childMarketId,
          postId: post._id,
          authorId: new Types.ObjectId(adminId),
          question: `${dto.question.trim()} - ${questionSuffix}`,
          category: "pvp",
          deadline: new Date(dto.deadline),
          lockTime,
          resolutionSource: dto.resolutionSource.trim(),
          yesCondition: outcomes[0] || "YES",
          noCondition: outcomes[1] || "NO",
          status: "funding_pool", // temporary status while funding
          marketType: "child",
          parentMarketId: parentMarket._id,
          optionName,
          teamName: teamA, // Keep teamA as primary associated team
          optionGroup,
          outcomeCount,
          outcomes,
          handicap,
        })

        // Pre-deposit 40 USDC on-chain
        const preDepositTxHash =
          await this.blockchainService.adminCreateMarketPreDeposit(
            childMarketId.toString(),
            40,
          )

        // Register on-chain with outcomeCount
        try {
          await this.blockchainService.registerMarket(
            childMarketId.toString(),
            adminWalletAddress,
            deadlineUnix,
            fundingDeadlineUnix,
            outcomeCount,
          )
        } catch (error) {
          const msg = error?.message || ""
          if (!msg.includes("MarketAlreadyRegistered")) {
            throw error
          }
        }

        // Initialize database pool from pre-deposit (which will sync and transition status to "tradable")
        await this.liquidityService.initializePoolFromPreDeposit(
          childMarketId.toString(),
          adminId,
          adminWalletAddress,
          preDepositTxHash,
          40,
        )

        const updatedChild = await this.marketModel.findById(childMarketId)
        if (updatedChild) {
          childMarkets.push(updatedChild)
        } else {
          childMarkets.push(child)
        }
      }

      this.logger.log(
        `Admin ${adminId} successfully deployed PvP Event: ${parentMarket._id} with ${childMarkets.length} child options and pre-deposited USDC.`,
      )

      // Broadcast updates
      this.socketGateway.broadcastToRoom("feed", "feed-updated", {})

      return {
        parentMarketId: parentMarket._id.toString(),
        question: parentMarket.question,
        childMarkets: childMarkets.map((c) => ({
          id: c._id.toString(),
          optionName: c.optionName,
          status: c.status,
        })),
      }
    } catch (error) {
      this.logger.error(
        `Failed to deploy PvP Event. Rolling back created database documents: ${error.message}`,
      )

      // Rollback child markets (and their liquidity pools/positions)
      for (const childId of childMarketIds) {
        try {
          await this.liquidityService.deletePoolAndPositions(childId.toString())
        } catch (poolErr) {
          this.logger.error(
            `Rollback error cleaning pool for ${childId}: ${poolErr.message}`,
          )
        }
        try {
          await this.marketModel.deleteOne({ _id: childId })
        } catch (dbErr) {
          this.logger.error(
            `Rollback error deleting child market ${childId}: ${dbErr.message}`,
          )
        }
      }

      // Rollback parent market
      if (parentMarket) {
        try {
          await this.marketModel.deleteOne({ _id: parentMarket._id })
        } catch (dbErr) {
          this.logger.error(
            `Rollback error deleting parent market: ${dbErr.message}`,
          )
        }
      }

      // Rollback post
      if (post) {
        try {
          await this.postModel.deleteOne({ _id: post._id })
        } catch (dbErr) {
          this.logger.error(`Rollback error deleting post: ${dbErr.message}`)
        }
      }

      throw error
    }
  }

  async lockPvpEvent(adminId: string, parentMarketId: string) {
    const admin = await this.userModel.findById(adminId)
    if (!admin || admin.role !== "admin") {
      throw new ForbiddenException("Only admins can lock PvP events.")
    }

    const parent = await this.marketModel.findById(parentMarketId)
    if (
      !parent ||
      parent.marketType !== "parent" ||
      parent.category !== "pvp"
    ) {
      throw new NotFoundException("PvP Event not found.")
    }

    parent.status = "closed"
    await parent.save()

    const childMarkets = await this.marketModel.find({
      parentMarketId: parent._id,
      marketType: "child",
    })

    for (const child of childMarkets) {
      child.status = "closed"
      await child.save()
    }

    await this.matchRemainingTicketsWithBot(parentMarketId)

    this.logger.log(
      `Admin ${adminId} successfully locked PvP Event: ${parentMarketId}`,
    )

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    return { success: true }
  }

  async matchRemainingTicketsWithBot(parentMarketId: string) {
    const queuedTickets = await this.pvpTicketModel.find({
      parentMarketId: new Types.ObjectId(parentMarketId),
      status: "queued",
    })

    if (queuedTickets.length === 0) {
      return
    }

    const childMarkets = await this.marketModel.find({
      parentMarketId: new Types.ObjectId(parentMarketId),
      marketType: "child",
    })

    for (const ticket of queuedTickets) {
      const profile =
        BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)]

      let botUser = await this.userModel.findOne({ username: profile.username })
      if (!botUser) {
        botUser = await this.userModel.create({
          username: profile.username,
          displayName: profile.displayName,
          role: "user",
          isOnboarded: true,
          avatarUrl: null,
        })
      }

      const botPicks: any[] = []
      for (const userPick of ticket.picks) {
        const child = childMarkets.find(
          (c) => c._id.toString() === userPick.marketId.toString(),
        )
        if (!child) continue

        let selection = ""
        if (child.outcomeCount && child.outcomeCount > 2) {
          const outcomes =
            child.outcomes && child.outcomes.length > 0
              ? child.outcomes
              : ["YES", "NO"]
          selection = outcomes[Math.floor(Math.random() * outcomes.length)]
        } else {
          selection = Math.random() < 0.5 ? "YES" : "NO"
        }

        botPicks.push({
          marketId: child._id,
          selection,
          isCorrect: null,
        })
      }

      const botTicket = await this.pvpTicketModel.create({
        userId: botUser._id,
        parentMarketId: ticket.parentMarketId,
        picks: botPicks,
        status: "matched",
        doubleBoostActive: false,
      })

      let divergence = 0
      for (const pick of ticket.picks) {
        const botPick = botPicks.find(
          (p) => p.marketId.toString() === pick.marketId.toString(),
        )
        if (botPick && botPick.selection !== pick.selection) {
          divergence += 1
        }
      }

      const match = await this.pvpMatchModel.create({
        parentMarketId: ticket.parentMarketId,
        ticket1Id: ticket._id,
        ticket2Id: botTicket._id,
        user1Id: ticket.userId,
        user2Id: botUser._id,
        divergenceScore: divergence,
        status: "matched",
      })

      ticket.status = "matched"
      ticket.matchId = match._id
      ticket.opponentTicketId = botTicket._id
      await ticket.save()

      botTicket.matchId = match._id
      botTicket.opponentTicketId = ticket._id
      await botTicket.save()

      this.clearSyncCache(ticket.userId.toString(), parentMarketId)

      this.socketGateway.broadcastToRoom(
        `user:${ticket.userId.toString()}`,
        "pvp-matched",
        { matchId: match._id.toString() },
      )

      await this.notificationsService.createNotification(
        ticket.userId.toString(),
        botUser._id.toString(),
        "pvp_matched",
        "PvP Arena Opponent Found!",
        `You've been matched against @${botUser.username} for the event with a selection divergence of ${divergence} picks.`,
        match._id.toString(),
      )

      this.logger.log(
        `Matched unmatched ticket ${ticket._id} with bot ticket ${botTicket._id} inside match: ${match._id}`,
      )

      // Cascade resolved states for already resolved child markets
      for (const child of childMarkets) {
        if (child.status === "resolved" || child.resolvedOutcome) {
          const outcome =
            child.resolvedOutcome ||
            (child.winningOutcomeIndex === 0 ? "YES" : "NO")
          await this.resolvePvpMatchesForMarket(child._id.toString(), outcome)
        }
      }
    }
  }

  async getActiveEvents() {
    const parents = await this.marketModel
      .find({
        category: "pvp",
        marketType: "parent",
        status: { $ne: "resolved" },
      })
      .sort({ deadline: 1 })

    if (parents.length === 0) return []

    const parentIds = parents.map((p) => p._id)

    // 1. Fetch all children in one query
    const allChildren = await this.marketModel.find({
      parentMarketId: { $in: parentIds },
      marketType: "child",
    })

    // Group children by parentMarketId
    const childrenMap = new Map<string, any[]>()
    for (const child of allChildren) {
      if (child.parentMarketId) {
        const pidStr = child.parentMarketId.toString()
        if (!childrenMap.has(pidStr)) {
          childrenMap.set(pidStr, [])
        }
        childrenMap.get(pidStr)!.push(child)
      }
    }

    // 2. Compute trade volume per child market via aggregation (avoids loading all trade docs)
    const allChildIds = allChildren.map((c) => c._id)
    const volumeAgg = await this.marketTradeModel.aggregate([
      { $match: { marketId: { $in: allChildIds } } },
      { $group: { _id: "$marketId", totalVolume: { $sum: "$amountUsdc" } } },
    ])
    const volumeMap = new Map<string, number>()
    for (const v of volumeAgg) {
      volumeMap.set(v._id.toString(), v.totalVolume)
    }

    // 3. Construct the response
    const result: any[] = []
    for (const parent of parents) {
      const pidStr = parent._id.toString()
      const children = childrenMap.get(pidStr) || []

      result.push({
        id: pidStr,
        question: parent.question,
        deadline: parent.deadline,
        lockTime: parent.lockTime,
        status: parent.status,
        createdAt: parent.createdAt,
        resolutionSource: parent.resolutionSource,
        yesCondition: parent.yesCondition,
        noCondition: parent.noCondition,
        options: children.map((c) => ({
          id: c._id.toString(),
          optionName: c.optionName,
          status: c.status,
          usdcYesAmount: c.usdcYesAmount,
          usdcNoAmount: c.usdcNoAmount,
          yesCondition: c.yesCondition,
          noCondition: c.noCondition,
          liquidity: c.liquidity,
          volume: volumeMap.get(c._id.toString()) || 0,
          optionGroup: c.optionGroup,
          outcomeCount: c.outcomeCount,
          outcomes: c.outcomes,
          outcomePrices: c.outcomePrices,
        })),
      })
    }

    return result
  }

  /**
   * Returns the parentMarketId + event question for every event where
   * the user still has an active (queued or matched) ticket.
   * Used by the frontend to merge into the events dropdown so
   * users can view their unresolved duels even after the event deadline.
   */
  async getMyActiveTickets(userId: string) {
    // 1. Find queued or matched tickets AND user positions with shares > 0 in parallel
    const [activeTickets, activePositions] = await Promise.all([
      this.pvpTicketModel.find({
        userId: new Types.ObjectId(userId),
        status: { $in: ["queued", "matched"] },
      }),
      this.marketPositionModel.find({
        userId: new Types.ObjectId(userId),
        shares: { $gt: 0 },
      }),
    ])

    const childMarketIds = activePositions.map((p) => p.marketId)
    const childMarkets = await this.marketModel.find({
      _id: { $in: childMarketIds },
      marketType: "child",
    })
    const parentMarketIdsFromPositions = childMarkets
      .map((m) => m.parentMarketId?.toString())
      .filter(Boolean)

    // 3. Find resolved tickets where parentMarketId is in parentMarketIdsFromPositions
    const resolvedTicketsWithShares = await this.pvpTicketModel.find({
      userId: new Types.ObjectId(userId),
      status: "resolved",
      parentMarketId: {
        $in: parentMarketIdsFromPositions.map((id) => new Types.ObjectId(id)),
      },
    })

    const tickets = [...activeTickets, ...resolvedTicketsWithShares]

    if (tickets.length === 0) return []

    // Deduplicate by parentMarketId
    const parentIds = [
      ...new Set(tickets.map((t) => t.parentMarketId.toString())),
    ]

    // Fetch all parent markets and child markets in parallel
    const parentObjectIds = parentIds.map((id) => new Types.ObjectId(id))
    const [parents, allChildren] = await Promise.all([
      this.marketModel.find({
        _id: { $in: parentObjectIds },
      }),
      this.marketModel.find({
        parentMarketId: { $in: parentObjectIds },
        marketType: "child",
      }),
    ])

    // Group children by parentMarketId
    const childrenMap = new Map<string, any[]>()
    for (const child of allChildren) {
      if (child.parentMarketId) {
        const pidStr = child.parentMarketId.toString()
        if (!childrenMap.has(pidStr)) {
          childrenMap.set(pidStr, [])
        }
        childrenMap.get(pidStr)!.push(child)
      }
    }

    // Compute trade volume per child market via aggregation (avoids loading all trade docs)
    const allChildIds = allChildren.map((c) => c._id)
    const volumeAgg = await this.marketTradeModel.aggregate([
      { $match: { marketId: { $in: allChildIds } } },
      { $group: { _id: "$marketId", totalVolume: { $sum: "$amountUsdc" } } },
    ])
    const volumeMap = new Map<string, number>()
    for (const v of volumeAgg) {
      volumeMap.set(v._id.toString(), v.totalVolume)
    }

    const result: any[] = []
    for (const parent of parents) {
      const pidStr = parent._id.toString()
      const children = childrenMap.get(pidStr) || []

      result.push({
        id: pidStr,
        question: parent.question,
        deadline: parent.deadline,
        lockTime: parent.lockTime,
        status: parent.status,
        createdAt: parent.createdAt,
        resolutionSource: parent.resolutionSource,
        yesCondition: parent.yesCondition,
        noCondition: parent.noCondition,
        options: children.map((c) => ({
          id: c._id.toString(),
          optionName: c.optionName,
          status: c.status,
          usdcYesAmount: c.usdcYesAmount,
          usdcNoAmount: c.usdcNoAmount,
          yesCondition: c.yesCondition,
          noCondition: c.noCondition,
          liquidity: c.liquidity,
          volume: volumeMap.get(c._id.toString()) || 0,
          optionGroup: c.optionGroup,
          outcomeCount: c.outcomeCount,
          outcomes: c.outcomes,
          outcomePrices: c.outcomePrices,
        })),
      })
    }

    return result
  }

  async submitTicket(userId: string, dto: SubmitTicketDto) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new NotFoundException("User not found.")

    const parent = await this.marketModel.findById(dto.parentMarketId)
    if (
      !parent ||
      parent.marketType !== "parent" ||
      parent.category !== "pvp"
    ) {
      throw new NotFoundException("PvP Event not found.")
    }

    const lockTimeLimit = parent.lockTime || parent.deadline
    if (new Date() >= lockTimeLimit) {
      throw new BadRequestException(
        "Event lock time has passed. Predictions are locked.",
      )
    }

    // Verify picks size
    if (dto.picks.length < 3) {
      throw new BadRequestException("Ticket must contain at least 3 picks.")
    }
    const childCount = await this.marketModel.countDocuments({
      parentMarketId: parent._id,
      marketType: "child",
    })
    if (dto.picks.length > childCount) {
      throw new BadRequestException(
        `Ticket cannot contain more than ${childCount} picks, but got ${dto.picks.length}.`,
      )
    }

    // Validate that the user doesn't select multiple options from the same group
    const childMarkets = await this.marketModel.find({
      parentMarketId: parent._id,
      marketType: "child",
    })
    const groupSelections: Record<string, string[]> = {}
    for (const pick of dto.picks) {
      const child = childMarkets.find((m) => m._id.toString() === pick.marketId)
      if (!child) {
        throw new BadRequestException(
          `Market option ${pick.marketId} not found in this event.`,
        )
      }
      if (child.optionGroup) {
        if (!groupSelections[child.optionGroup]) {
          groupSelections[child.optionGroup] = []
        }
        groupSelections[child.optionGroup].push(pick.marketId)
      }
    }

    for (const [group, marketIds] of Object.entries(groupSelections)) {
      if (marketIds.length > 1) {
        throw new BadRequestException(
          `You cannot make multiple selections from the same option group: ${group}.`,
        )
      }
    }

    // Cancel existing queued/matched ticket
    const existing = await this.pvpTicketModel.findOne({
      userId: new Types.ObjectId(userId),
      parentMarketId: parent._id,
      status: { $in: ["queued", "matched"] },
    })

    if (existing) {
      if (existing.status === "matched") {
        throw new BadRequestException(
          "You have already been matched with an opponent for this match. Selections are locked.",
        )
      }
      existing.status = "cancelled"
      await existing.save()
    }

    // Check if new user welcome boosts apply
    const cutoffStr = this.configService.get<string>("NEW_USER_CUTOFF_DATE")
    const cutoffDate = cutoffStr ? new Date(cutoffStr) : null
    const isNewUser =
      cutoffDate && user.createdAt && new Date(user.createdAt) >= cutoffDate

    let xpBoostMultiplier = 1.0
    let doubleBoostActive = false

    if (isNewUser) {
      const ticketCount = await this.pvpTicketModel.countDocuments({
        userId: user._id,
        status: { $ne: "cancelled" },
      })
      if (ticketCount === 0) {
        xpBoostMultiplier = 2.0
        doubleBoostActive = true
        this.logger.log(
          `User ${userId} qualifies for Welcome Boost 1 (2.0x XP).`,
        )
      } else if (ticketCount === 1) {
        xpBoostMultiplier = 1.5
        doubleBoostActive = true
        this.logger.log(
          `User ${userId} qualifies for Welcome Boost 2 (1.5x XP).`,
        )
      }
    }

    // If welcome boosts were not applied, try to consume 2.0x downtime compensation boost
    if (!doubleBoostActive) {
      const updateResult = await this.userModel.findOneAndUpdate(
        { _id: user._id, downtimeBoostRemaining: { $gt: 0 } },
        { $inc: { downtimeBoostRemaining: -1 } },
        { new: true },
      )
      if (updateResult) {
        doubleBoostActive = true
        xpBoostMultiplier = 2.0
        this.logger.log(
          `User ${userId} consumed a 2.0x downtime compensation boost. remaining: ${updateResult.downtimeBoostRemaining}`,
        )
      }
    }

    // If welcome boosts were not applied, try to consume Bronze 1.5x boost
    if (!doubleBoostActive) {
      if (
        user.arenaXp >= 30 &&
        user.arenaXp <= 499 &&
        !user.hasUsedBronzeBoost
      ) {
        const updateResult = await this.userModel.findOneAndUpdate(
          { _id: user._id, hasUsedBronzeBoost: false },
          { $set: { hasUsedBronzeBoost: true } },
          { new: true },
        )
        if (updateResult) {
          doubleBoostActive = true
          xpBoostMultiplier = 1.5
          this.logger.log(`User ${userId} consumed one-time Bronze 1.5x boost.`)
        }
      }
    }

    // If welcome and bronze boosts were not applied, try to consume standard referral boost
    if (!doubleBoostActive) {
      const updateResult = await this.userModel.findOneAndUpdate(
        { _id: user._id, doubleBoostRemaining: { $gt: 0 } },
        { $inc: { doubleBoostRemaining: -1 } },
        { new: true },
      )
      if (updateResult) {
        doubleBoostActive = true
        xpBoostMultiplier = 1.2
        this.logger.log(
          `User ${userId} consumed an XP boost. remaining: ${updateResult.doubleBoostRemaining}`,
        )
      }
    }

    // Create the ticket
    const ticket = await this.pvpTicketModel.create({
      userId: new Types.ObjectId(userId),
      parentMarketId: parent._id,
      picks: dto.picks.map((p) => ({
        marketId: new Types.ObjectId(p.marketId),
        selection: p.selection,
        isCorrect: null,
      })),
      status: "queued",
      doubleBoostActive,
      xpBoostMultiplier,
    })

    // Perform matchmaking
    const match = await this.matchmake(ticket)

    // Clear sync cache so the user's updated positions are fetched on status query
    this.clearSyncCache(userId, dto.parentMarketId)

    return {
      ticketId: ticket._id.toString(),
      status: ticket.status,
      matched: !!match,
      matchId: match ? match._id.toString() : null,
      doubleBoostActive,
    }
  }

  async matchmake(ticket: PvpTicketDocument): Promise<PvpMatchDocument | null> {
    const candidates = await this.pvpTicketModel.find({
      parentMarketId: ticket.parentMarketId,
      userId: { $ne: ticket.userId },
      status: "queued",
    })

    if (candidates.length === 0) {
      return null
    }

    let bestOpponent: PvpTicketDocument | null = null
    let maxDivergence = -1

    for (const candidate of candidates) {
      let divergence = 0
      for (const pick of ticket.picks) {
        const candidatePick = candidate.picks.find(
          (p) => p.marketId.toString() === pick.marketId.toString(),
        )
        if (candidatePick && candidatePick.selection !== pick.selection) {
          divergence += 1
        }
      }

      if (divergence < 1) {
        continue // Skip exact same picks to avoid pre-determined draws!
      }

      if (divergence > maxDivergence) {
        maxDivergence = divergence
        bestOpponent = candidate
      } else if (divergence === maxDivergence && bestOpponent) {
        // Tie-breaker: oldest queued ticket
        if (candidate.createdAt! < bestOpponent.createdAt!) {
          bestOpponent = candidate
        }
      }
    }

    if (maxDivergence < 1 || !bestOpponent) return null

    // Match found! Create PvpMatch
    const match = await this.pvpMatchModel.create({
      parentMarketId: ticket.parentMarketId,
      ticket1Id: ticket._id,
      ticket2Id: bestOpponent._id,
      user1Id: ticket.userId,
      user2Id: bestOpponent.userId,
      divergenceScore: maxDivergence,
      status: "matched",
    })

    // Update tickets status to matched
    ticket.status = "matched"
    ticket.matchId = match._id
    ticket.opponentTicketId = bestOpponent._id
    await ticket.save()

    bestOpponent.status = "matched"
    bestOpponent.matchId = match._id
    bestOpponent.opponentTicketId = ticket._id
    await bestOpponent.save()

    // Query usernames to send personalized alerts
    const [user1, user2] = await Promise.all([
      this.userModel.findById(ticket.userId),
      this.userModel.findById(bestOpponent.userId),
    ])
    const u1Name = user1?.username || "someone"
    const u2Name = user2?.username || "someone"

    // Emit Socket events
    this.socketGateway.broadcastToRoom(
      `user:${ticket.userId.toString()}`,
      "pvp-matched",
      { matchId: match._id.toString() },
    )
    this.socketGateway.broadcastToRoom(
      `user:${bestOpponent.userId.toString()}`,
      "pvp-matched",
      { matchId: match._id.toString() },
    )

    // In-app Notifications
    await this.notificationsService.createNotification(
      ticket.userId.toString(),
      bestOpponent.userId.toString(),
      "pvp_matched",
      "PvP Arena Opponent Found!",
      `You've been matched against @${u2Name} for the event with a selection divergence of ${maxDivergence} picks.`,
      match._id.toString(),
    )
    await this.notificationsService.createNotification(
      bestOpponent.userId.toString(),
      ticket.userId.toString(),
      "pvp_matched",
      "PvP Arena Opponent Found!",
      `You've been matched against @${u1Name} for the event with a selection divergence of ${maxDivergence} picks.`,
      match._id.toString(),
    )

    this.logger.log(
      `Matched tickets: ${ticket._id} and ${bestOpponent._id} inside match: ${match._id}`,
    )
    return match
  }

  async resolvePvpMatchesForMarket(marketId: string, winningOutcome: string) {
    // Find all matched or resolved tickets containing this child market
    const tickets = await this.pvpTicketModel.find({
      status: { $in: ["matched", "resolved"] },
      "picks.marketId": new Types.ObjectId(marketId),
    })

    if (tickets.length === 0) return

    const market = await this.marketModel.findById(marketId)

    this.logger.log(
      `Resolving child market ${marketId} outcome: ${winningOutcome} on ${tickets.length} PvP tickets.`,
    )

    for (const ticket of tickets) {
      let updated = false
      for (const pick of ticket.picks) {
        if (pick.marketId.toString() === marketId) {
          const normalizedSelection = pick.selection.toUpperCase().trim()
          const normalizedWinner = winningOutcome.toUpperCase().trim()
          let isCorrect = false

          if (market && market.outcomeCount === 2) {
            const yesText = (market.outcomes[0] || "YES").toUpperCase().trim()
            const noText = (market.outcomes[1] || "NO").toUpperCase().trim()

            if (normalizedSelection === "YES") {
              isCorrect =
                normalizedWinner === "YES" || normalizedWinner === yesText
            } else if (normalizedSelection === "NO") {
              isCorrect =
                normalizedWinner === "NO" || normalizedWinner === noText
            }
          } else {
            const isStringMatch = normalizedSelection === normalizedWinner
            let isIndexMatch = false
            if (market && market.outcomes && market.outcomes.length > 0) {
              const selIdx = market.outcomes.findIndex(
                (o) =>
                  o.toLowerCase().trim() ===
                  pick.selection.toLowerCase().trim(),
              )
              const winIdx = market.outcomes.findIndex(
                (o) =>
                  o.toLowerCase().trim() ===
                  winningOutcome.toLowerCase().trim(),
              )
              if (selIdx >= 0 && winIdx >= 0 && selIdx === winIdx) {
                isIndexMatch = true
              }
            }
            isCorrect = isStringMatch || isIndexMatch
          }

          pick.isCorrect = isCorrect
          updated = true

          // Archive losing position immediately so they don't clutter the active ticket list
          if (!pick.isCorrect) {
            await this.marketPositionModel.updateOne(
              {
                marketId: pick.marketId,
                userId: ticket.userId,
                side: pick.selection,
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
      }

      if (updated) {
        ticket.markModified("picks")
        await ticket.save()

        // Check if all picks are resolved
        const allResolved = ticket.picks.every((p) => p.isCorrect !== null)
        if (allResolved) {
          const match = await this.pvpMatchModel.findById(ticket.matchId)
          if (match && match.status === "matched") {
            const ticket1 = await this.pvpTicketModel.findById(match.ticket1Id)
            const ticket2 = await this.pvpTicketModel.findById(match.ticket2Id)

            // Check if both tickets are now fully resolved
            if (
              ticket1 &&
              ticket2 &&
              ticket1.picks.every((p) => p.isCorrect !== null) &&
              ticket2.picks.every((p) => p.isCorrect !== null)
            ) {
              await this.resolveMatch(match, ticket1, ticket2)
            }
          }
        }
      }
    }
  }

  private async resolveMatch(
    match: PvpMatchDocument,
    ticket1: PvpTicketDocument,
    ticket2: PvpTicketDocument,
  ) {
    this.logger.log(
      `Resolving PvP match ${match._id} for users ${match.user1Id} and ${match.user2Id}`,
    )

    // 1. Each correct prediction is worth one match point.
    const score1 = calculatePvpScore(ticket1.picks)
    const score2 = calculatePvpScore(ticket2.picks)

    // 2. The player with more correct predictions wins. Equal score is a draw.
    let winnerId: Types.ObjectId | null = null
    if (score1 > score2) {
      winnerId = match.user1Id
    } else if (score2 > score1) {
      winnerId = match.user2Id
    }

    // 3. Load Users
    const [user1, user2] = await Promise.all([
      this.userModel.findById(match.user1Id),
      this.userModel.findById(match.user2Id),
    ])
    if (!user1 || !user2) return

    const result1: PvpResult = winnerId
      ? winnerId.toString() === user1._id.toString()
        ? "win"
        : "loss"
      : "draw"
    const result2: PvpResult = winnerId
      ? winnerId.toString() === user2._id.toString()
        ? "win"
        : "loss"
      : "draw"

    // 4. Query total child markets for perfect score bonus check.
    const childMarketCount = await this.marketModel.countDocuments({
      parentMarketId: match.parentMarketId,
      marketType: "child",
    })

    // 5. Award Result XP, a +20 perfect bonus (if they predicted all child markets correctly), and an optional boost.
    const xp1 = calculatePvpResultXp(
      result1,
      score1,
      childMarketCount,
      ticket1.doubleBoostActive,
      ticket1.xpBoostMultiplier,
    )
    const xp2 = calculatePvpResultXp(
      result2,
      score2,
      childMarketCount,
      ticket2.doubleBoostActive,
      ticket2.xpBoostMultiplier,
    )

    const isBot1 = BOT_PROFILES.some((p) => p.username === user1.username)
    const isBot2 = BOT_PROFILES.some((p) => p.username === user2.username)

    // 5. Update user stats
    if (!isBot1) {
      user1.arenaXp += xp1
      user1.pvpTicketsSubmittedCount += 1
      if (winnerId) {
        if (winnerId.toString() === user1._id.toString()) {
          user1.pvpMatchesWonCount += 1
          if (!user1.hasWonFirstPvpDuel) {
            user1.hasWonFirstPvpDuel = true
            if (user1.referredById) {
              await this.awardReferrerFirstWinBoosts(user1)
            }
          }
        } else {
          user1.pvpMatchesLostCount += 1
        }
      } else {
        user1.pvpMatchesDrawnCount += 1
      }
      await user1.save()
    }

    if (!isBot2) {
      user2.arenaXp += xp2
      user2.pvpTicketsSubmittedCount += 1
      if (winnerId) {
        if (winnerId.toString() === user2._id.toString()) {
          user2.pvpMatchesWonCount += 1
          if (!user2.hasWonFirstPvpDuel) {
            user2.hasWonFirstPvpDuel = true
            if (user2.referredById) {
              await this.awardReferrerFirstWinBoosts(user2)
            }
          }
        } else {
          user2.pvpMatchesLostCount += 1
        }
      } else {
        user2.pvpMatchesDrawnCount += 1
      }
      await user2.save()
    }

    // 6. Update Match and Ticket records
    match.status = "resolved"
    match.winnerId = winnerId
    match.resolvedAt = new Date()
    await match.save()

    ticket1.status = "resolved"
    ticket1.score = score1
    ticket1.xpEarned = xp1
    await ticket1.save()

    ticket2.status = "resolved"
    ticket2.score = score2
    ticket2.xpEarned = xp2
    await ticket2.save()

    // Broadcast Socket events
    if (!isBot1) {
      this.socketGateway.broadcastToRoom(
        `user:${user1._id.toString()}`,
        "pvp-resolved",
        { matchId: match._id.toString() },
      )
      this.socketGateway.broadcastToRoom(
        `user:${user1._id.toString()}`,
        "user-updated",
        {},
      )
    }
    if (!isBot2) {
      this.socketGateway.broadcastToRoom(
        `user:${user2._id.toString()}`,
        "pvp-resolved",
        { matchId: match._id.toString() },
      )
      this.socketGateway.broadcastToRoom(
        `user:${user2._id.toString()}`,
        "user-updated",
        {},
      )
    }

    // In-app Notifications
    const u1 = user1.username
    const u2 = user2.username
    const res1 = winnerId
      ? winnerId.toString() === user1._id.toString()
        ? "WON 🏆"
        : "LOST ❌"
      : "TIED 🤝"
    const res2 = winnerId
      ? winnerId.toString() === user2._id.toString()
        ? "WON 🏆"
        : "LOST ❌"
      : "TIED 🤝"

    if (!isBot1) {
      await this.notificationsService.createNotification(
        user1._id.toString(),
        user2._id.toString(),
        "pvp_resolved",
        `PvP Duel Resolved: You ${res1}`,
        `Your battle against @${u2} resolved. Score: ${score1}/${ticket1.picks.length} vs ${score2}/${ticket2.picks.length}. Arena XP earned: +${xp1}.`,
        match._id.toString(),
      )
    }
    if (!isBot2) {
      await this.notificationsService.createNotification(
        user2._id.toString(),
        user1._id.toString(),
        "pvp_resolved",
        `PvP Duel Resolved: You ${res2}`,
        `Your battle against @${u1} resolved. Score: ${score2}/${ticket2.picks.length} vs ${score1}/${ticket1.picks.length}. Arena XP earned: +${xp2}.`,
        match._id.toString(),
      )
    }
  }

  /**
   * Syncs on-chain balances for a user's child markets in the background.
   * This is intentionally called as fire-and-forget from getPvpStatus().
   */
  private async syncOnChainBalances(
    userId: string,
    walletAddress: string,
    children: any[],
  ) {
    // Pre-fetch on-chain balances for all child markets in a single batch query
    const batchQueries = children.map((child) => {
      const outcomes =
        child.outcomes && child.outcomes.length > 0
          ? child.outcomes
          : ["YES", "NO"]
      return {
        marketId: child._id.toString(),
        outcomes,
      }
    })

    let balancesMap: Record<string, Record<string, number>> = {}
    try {
      balancesMap = await this.blockchainService.getUserOnChainBalancesBatch(
        batchQueries,
        walletAddress,
      )
    } catch (err) {
      this.logger.error(
        `Error syncing position batch in syncOnChainBalances: ${err.message}`,
      )
      return
    }

    // Fetch existing positions in db to avoid redundant database writes
    const existingPositions = await this.marketPositionModel.find({
      userId: new Types.ObjectId(userId),
      marketId: { $in: children.map((c) => c._id) },
    })

    for (const child of children) {
      try {
        const outcomes =
          child.outcomes && child.outcomes.length > 0
            ? child.outcomes
            : ["YES", "NO"]

        const onChain = balancesMap[child._id.toString()] || {}

        const isResolved = child.status === "resolved" || child.resolvedOutcome
        const winningOutcome = child.resolvedOutcome
        const isMulti = child.outcomeCount && child.outcomeCount > 2

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

          // Find if we already have this position in DB matching normalizedSide
          const dbPos = existingPositions.find(
            (p) =>
              p.marketId.toString() === child._id.toString() &&
              p.side === normalizedSide,
          )

          if (!isLosing && balance > 0) {
            // If there's no matching position, or the shares count differs, update/upsert
            if (!dbPos || dbPos.shares !== balance) {
              await this.marketPositionModel.updateOne(
                {
                  marketId: child._id,
                  userId: new Types.ObjectId(userId),
                  side: normalizedSide,
                },
                {
                  $set: { shares: balance },
                  $setOnInsert: {
                    avgPrice: 0.5,
                    investedUsdc: balance * 0.5,
                    realizedPnl: 0,
                  },
                },
                { upsert: true },
              )
            }
          } else {
            // If there's a matching position, archive it
            if (dbPos) {
              await this.marketPositionModel.updateOne(
                {
                  marketId: child._id,
                  userId: new Types.ObjectId(userId),
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
        }
      } catch (err) {
        this.logger.error(
          `Error syncing position in syncOnChainBalances for child ${child._id}: ${err.message}`,
        )
      }
    }
  }

  private async awardReferrerFirstWinBoosts(referredPlayer: UserDocument) {
    const referrer = await this.userModel.findById(referredPlayer.referredById)
    if (!referrer) return

    // Find up to 2 active (queued/matched) tickets for the referrer that do not have any boosts active.
    const activeUnboostedTickets = await this.pvpTicketModel
      .find({
        userId: referrer._id,
        status: { $in: ["queued", "matched"] },
        doubleBoostActive: false,
      })
      .sort({ createdAt: 1 })
      .limit(2)

    let appliedBoostsCount = 0
    for (const ticket of activeUnboostedTickets) {
      ticket.doubleBoostActive = true
      ticket.xpBoostMultiplier = 1.2
      await ticket.save()
      appliedBoostsCount++
      this.logger.log(
        `Retroactively applied 1.2x boost to referrer ${referrer._id}'s active ticket ${ticket._id}`,
      )
    }

    const boostsToAdd = 2 - appliedBoostsCount
    if (boostsToAdd > 0) {
      referrer.doubleBoostRemaining =
        (referrer.doubleBoostRemaining ?? 0) + boostsToAdd
      await referrer.save()
      this.logger.log(
        `Added ${boostsToAdd} boosts to referrer ${referrer._id}'s doubleBoostRemaining (applied ${appliedBoostsCount} retroactively)`,
      )
    } else {
      this.logger.log(
        `Applied all 2 boosts retroactively to referrer ${referrer._id}'s active tickets`,
      )
    }

    // Clear referrer's sync cache so updated ticket boosts are immediately visible
    this.clearSyncCache(referrer._id.toString())

    await this.notificationsService.createNotification(
      referrer._id.toString(),
      referredPlayer._id.toString(),
      "pvp_boost",
      "Referral XP Boosts Awarded!",
      `Your referred friend @${referredPlayer.username} won their first duel. You received 2 Arena XP boosts (1.2x XP each).`,
      referredPlayer._id.toString(),
    )

    this.logger.log(
      `Two XP boosts awarded to referrer ${referrer._id} after referred player ${referredPlayer._id} earned their first win`,
    )
  }

  async getPvpStatus(userId: string, parentMarketId?: string) {
    const query: any = {
      userId: new Types.ObjectId(userId),
      status: { $in: ["queued", "matched", "resolved"] },
    }
    if (parentMarketId) {
      query.parentMarketId = new Types.ObjectId(parentMarketId)
    }

    // Find the latest active ticket (either queued, matched, or resolved)
    let ticket = await this.pvpTicketModel
      .findOne(query)
      .sort({ createdAt: -1 })

    if (!ticket) return null

    // Just-In-Time Bot Matchmaking if lockTime limit has passed
    if (ticket.status === "queued") {
      const parent = await this.marketModel.findById(ticket.parentMarketId)
      if (parent) {
        const lockTimeLimit = parent.lockTime || parent.deadline
        if (new Date() >= lockTimeLimit) {
          await this.matchRemainingTicketsWithBot(parent._id.toString())
          // Re-fetch ticket to get updated matched status
          ticket = await this.pvpTicketModel.findById(ticket._id)
          if (!ticket) return null
        }
      }
    }

    const parentId = ticket.parentMarketId
    // Parallelize independent lookups: match, parent + children, user, opponentTicket
    const [match, allMarkets, user, opponentTicket] = await Promise.all([
      ticket.matchId
        ? this.pvpMatchModel.findById(ticket.matchId)
        : Promise.resolve(null),
      this.marketModel.find({
        $or: [{ _id: parentId }, { parentMarketId: parentId }],
      }),
      this.userModel.findById(userId),
      ticket.opponentTicketId
        ? this.pvpTicketModel.findById(ticket.opponentTicketId)
        : Promise.resolve(null),
    ])

    const parent = allMarkets.find(
      (m) => m._id.toString() === parentId.toString(),
    )
    const children = allMarkets.filter(
      (m) => m.parentMarketId?.toString() === parentId.toString(),
    )

    // Fire-and-forget on-chain balance sync (non-blocking)
    if (user && user.walletAddress) {
      const syncKey = `${userId}:${parentMarketId || ""}`
      const lastSync = this.lastSyncMap.get(syncKey) || 0
      if (Date.now() - lastSync > 10000) {
        this.lastSyncMap.set(syncKey, Date.now())
        this.syncOnChainBalances(userId, user.walletAddress, children).catch(
          (err) =>
            this.logger.error(
              `Background on-chain sync failed: ${err.message}`,
            ),
        )
      }
    }

    // Fetch user positions, trade volume, and opponent in parallel (aggregation for volume)
    const childMarketIds = children.map((c) => c._id)
    const [userPositions, volumeAgg, opponent] = await Promise.all([
      this.marketPositionModel.find({
        userId: new Types.ObjectId(userId),
        marketId: { $in: childMarketIds },
        shares: { $gt: 0 },
      }),
      this.marketTradeModel.aggregate([
        { $match: { marketId: { $in: childMarketIds } } },
        { $group: { _id: "$marketId", totalVolume: { $sum: "$amountUsdc" } } },
      ]),
      opponentTicket
        ? this.userModel.findById(opponentTicket.userId)
        : Promise.resolve(null),
    ])

    const volumeMap: Record<string, number> = {}
    for (const v of volumeAgg) {
      volumeMap[v._id.toString()] = v.totalVolume
    }

    return {
      status: ticket.status,
      ticket: {
        id: ticket._id.toString(),
        status: ticket.status,
        score: ticket.score,
        xpEarned: ticket.xpEarned,
        doubleBoostActive: ticket.doubleBoostActive,
        xpBoostMultiplier: ticket.xpBoostMultiplier ?? 1.0,
        picks: ticket.picks.map((p) => {
          const matchChild = children.find(
            (c) => c._id.toString() === p.marketId.toString(),
          )
          const position = userPositions.find(
            (pos) =>
              pos.marketId.toString() === p.marketId.toString() &&
              pos.side === p.selection,
          )
          return {
            marketId: p.marketId.toString(),
            optionName: matchChild?.optionName || "Unknown Proposition",
            selection: p.selection,
            isCorrect: p.isCorrect,
            yesCondition: matchChild?.yesCondition || "YES",
            noCondition: matchChild?.noCondition || "NO",
            shares: position?.shares ?? 0,
            investedUsdc: position?.investedUsdc ?? 0,
            status: matchChild?.status || "unknown",
            resolvedOutcome: matchChild?.resolvedOutcome || null,
          }
        }),
      },
      match: match
        ? {
            id: match._id.toString(),
            divergenceScore: match.divergenceScore,
            status: match.status,
          }
        : null,
      opponent: opponent
        ? {
            id: opponent._id.toString(),
            username: opponent.username,
            avatarUrl: opponent.avatarUrl,
            picks: opponentTicket
              ? opponentTicket.picks.map((p) => {
                  const matchChild = children.find(
                    (c) => c._id.toString() === p.marketId.toString(),
                  )
                  return {
                    marketId: p.marketId.toString(),
                    optionName: matchChild?.optionName || "Unknown Proposition",
                    selection: p.selection,
                    isCorrect: p.isCorrect,
                    yesCondition: matchChild?.yesCondition || "YES",
                    noCondition: matchChild?.noCondition || "NO",
                  }
                })
              : [],
          }
        : null,
      event: parent
        ? {
            id: parent._id.toString(),
            question: parent.question,
            deadline: parent.deadline,
            lockTime: parent.lockTime,
            status: parent.status,
            options: children.map((c) => ({
              id: c._id.toString(),
              optionName: c.optionName || c.question,
              status: c.status,
              usdcYesAmount: c.usdcYesAmount,
              usdcNoAmount: c.usdcNoAmount,
              yesCondition: c.yesCondition || "YES",
              noCondition: c.noCondition || "NO",
              liquidity: c.liquidity || 0,
              volume: volumeMap[c._id.toString()] || 0,
              optionGroup: c.optionGroup,
              outcomeCount: c.outcomeCount,
              outcomes: c.outcomes,
              outcomePrices: c.outcomePrices,
            })),
          }
        : null,
    }
  }

  async getLeaderboards(userId?: string) {
    // Fetch top 50 rankings and current target user in parallel
    const [xpList, referrerRankings, targetUser] = await Promise.all([
      this.userModel
        .find({
          isOnboarded: true,
        })
        .sort({ arenaXp: -1 })
        .limit(50),
      this.userModel.aggregate([
        { $match: { referredById: { $ne: null } } },
        { $group: { _id: "$referredById", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "referrerUser",
          },
        },
        { $unwind: "$referrerUser" },
      ]),
      userId ? this.userModel.findById(userId) : Promise.resolve(null),
    ])

    let currentUserXp: number | null = null
    let currentUserXpRank: number | null = null
    let currentUserReferral: number | null = null
    let currentUserReferralRank: number | null = null

    if (targetUser && targetUser.isOnboarded) {
      currentUserXp = targetUser.arenaXp ?? 0

      // Compute user XP Rank and Referrals count in parallel
      const [xpRankCount, referralCount] = await Promise.all([
        this.userModel.countDocuments({
          isOnboarded: true,
          $or: [
            { arenaXp: { $gt: currentUserXp } },
            { arenaXp: currentUserXp, _id: { $lt: targetUser._id } },
          ],
        }),
        this.userModel.countDocuments({
          referredById: targetUser._id,
        }),
      ])

      currentUserXpRank = xpRankCount + 1
      currentUserReferral = referralCount

      // Compute user Referral Rank using the retrieved referralCount
      const rankAggregation = await this.userModel.aggregate([
        { $match: { referredById: { $ne: null } } },
        { $group: { _id: "$referredById", count: { $sum: 1 } } },
        {
          $match: {
            $or: [
              { count: { $gt: currentUserReferral } },
              { count: currentUserReferral, _id: { $lt: targetUser._id } },
            ],
          },
        },
        { $count: "count" },
      ])
      const higherCount = rankAggregation[0]?.count || 0
      currentUserReferralRank = higherCount + 1
    }

    return {
      xp: xpList.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        arenaXp: u.arenaXp ?? 0,
        pvpMatchesLostCount: u.pvpMatchesLostCount ?? 0,
      })),
      referrers: referrerRankings.map((r) => ({
        id: r.referrerUser._id.toString(),
        username: r.referrerUser.username,
        displayName: r.referrerUser.displayName,
        avatarUrl: r.referrerUser.avatarUrl,
        referralCount: r.count,
        arenaXp: r.referrerUser.arenaXp ?? 0,
      })),
      currentUserXp,
      currentUserXpRank,
      currentUserReferral,
      currentUserReferralRank,
    }
  }

  async getReferrals(userId: string) {
    const [user, referees] = await Promise.all([
      this.userModel.findById(userId),
      this.userModel
        .find({
          referredById: new Types.ObjectId(userId),
        })
        .sort({ arenaXp: -1 }),
    ])

    if (!user) throw new NotFoundException("User not found.")

    // Check welcome boosts eligibility
    const cutoffStr = this.configService.get<string>("NEW_USER_CUTOFF_DATE")
    const cutoffDate = cutoffStr ? new Date(cutoffStr) : null
    const isNewUser =
      cutoffDate && user.createdAt && new Date(user.createdAt) >= cutoffDate

    let nextGameMultiplier = 1.0
    let ticketsCount = 0
    let isEligible = false

    if (isNewUser) {
      ticketsCount = await this.pvpTicketModel.countDocuments({
        userId: user._id,
        status: { $ne: "cancelled" },
      })
      if (ticketsCount === 0) {
        isEligible = true
        nextGameMultiplier = 2.0
      } else if (ticketsCount === 1) {
        isEligible = true
        nextGameMultiplier = 1.5
      }
    }

    if (nextGameMultiplier === 1.0) {
      if ((user.downtimeBoostRemaining ?? 0) > 0) {
        nextGameMultiplier = 2.0
      } else {
        const isBronze = user.arenaXp >= 30 && user.arenaXp <= 499
        if (isBronze && !user.hasUsedBronzeBoost) {
          nextGameMultiplier = 1.5
        } else if ((user.doubleBoostRemaining ?? 0) > 0) {
          nextGameMultiplier = 1.2
        }
      }
    }

    return {
      referralLink: user.username,
      doubleBoostRemaining: user.doubleBoostRemaining ?? 0,
      downtimeBoostRemaining: user.downtimeBoostRemaining ?? 0,
      hasWonFirstPvpDuel: user.hasWonFirstPvpDuel ?? false,
      welcomeBoosts: {
        isEligible,
        nextGameMultiplier,
        ticketsCount,
      },
      referees: referees.map((r) => ({
        id: r._id.toString(),
        username: r.username,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        arenaXp: r.arenaXp ?? 0,
        hasWonFirstPvpDuel: r.hasWonFirstPvpDuel ?? false,
      })),
    }
  }

  async getMatchHistory(userId: string) {
    const uId = new Types.ObjectId(userId)
    // Find resolved matches where user was user1 or user2
    const matches = await this.pvpMatchModel
      .find({
        $or: [{ user1Id: uId }, { user2Id: uId }],
        status: "resolved",
      })
      .sort({ resolvedAt: -1 })
      .limit(30)

    if (matches.length === 0) return []

    const parentMarketIds = [
      ...new Set(matches.map((m) => m.parentMarketId.toString())),
    ].map((id) => new Types.ObjectId(id))
    const ticketIds: Types.ObjectId[] = []
    const opponentIds: Types.ObjectId[] = []

    for (const match of matches) {
      const isUser1 = match.user1Id.toString() === userId
      const myTicketId = isUser1 ? match.ticket1Id : match.ticket2Id
      const oppTicketId = isUser1 ? match.ticket2Id : match.ticket1Id
      const oppId = isUser1 ? match.user2Id : match.user1Id

      ticketIds.push(new Types.ObjectId(myTicketId))
      ticketIds.push(new Types.ObjectId(oppTicketId))
      opponentIds.push(new Types.ObjectId(oppId))
    }

    // Deduplicate ticketIds and opponentIds
    const uniqueTicketIds = [
      ...new Set(ticketIds.map((id) => id.toString())),
    ].map((id) => new Types.ObjectId(id))
    const uniqueOpponentIds = [
      ...new Set(opponentIds.map((id) => id.toString())),
    ].map((id) => new Types.ObjectId(id))

    // Run batch queries in parallel
    const [parents, allChildren, allTickets, opponents] = await Promise.all([
      this.marketModel.find({ _id: { $in: parentMarketIds } }),
      this.marketModel.find({
        parentMarketId: { $in: parentMarketIds },
        marketType: "child",
      }),
      this.pvpTicketModel.find({ _id: { $in: uniqueTicketIds } }),
      this.userModel.find({ _id: { $in: uniqueOpponentIds } }),
    ])

    const allChildIds = allChildren.map((c) => c._id)
    const userIdsForTrades = [uId, ...uniqueOpponentIds]
    const allTrades = await this.marketTradeModel.find({
      userId: { $in: userIdsForTrades },
      marketId: { $in: allChildIds },
      action: "BUY",
    })

    // Construct Maps for quick O(1) lookup
    const parentsMap = new Map<string, any>()
    for (const p of parents) {
      parentsMap.set(p._id.toString(), p)
    }

    const childrenMap = new Map<string, any[]>()
    for (const child of allChildren) {
      if (child.parentMarketId) {
        const pidStr = child.parentMarketId.toString()
        if (!childrenMap.has(pidStr)) {
          childrenMap.set(pidStr, [])
        }
        childrenMap.get(pidStr)!.push(child)
      }
    }

    const ticketsMap = new Map<string, any>()
    for (const t of allTickets) {
      ticketsMap.set(t._id.toString(), t)
    }

    const opponentsMap = new Map<string, any>()
    for (const o of opponents) {
      opponentsMap.set(o._id.toString(), o)
    }

    // Map trades by userId and marketId
    const tradesMap = new Map<string, any>()
    for (const t of allTrades) {
      const key = `${t.userId.toString()}:${t.marketId.toString()}`
      if (!tradesMap.has(key)) {
        tradesMap.set(key, t)
      }
    }

    const result: any[] = []
    for (const match of matches) {
      const parent = parentsMap.get(match.parentMarketId.toString())

      const isUser1 = match.user1Id.toString() === userId
      const myTicketId = isUser1 ? match.ticket1Id : match.ticket2Id
      const oppTicketId = isUser1 ? match.ticket2Id : match.ticket1Id
      const oppId = isUser1 ? match.user2Id : match.user1Id

      const myTicket = ticketsMap.get(myTicketId.toString())
      const oppTicket = ticketsMap.get(oppTicketId.toString())
      const oppUser = opponentsMap.get(oppId.toString())

      let outcome: "WIN" | "LOSS" | "DRAW" = "DRAW"
      if (match.winnerId) {
        outcome = match.winnerId.toString() === userId ? "WIN" : "LOSS"
      }

      const children = childrenMap.get(match.parentMarketId.toString()) || []

      const myPicks = myTicket
        ? myTicket.picks.map((p: any) => {
            const child = children.find(
              (c: any) => c._id.toString() === p.marketId.toString(),
            )
            const trade = tradesMap.get(
              `${uId.toString()}:${p.marketId.toString()}`,
            )
            const investedUsdc = trade ? trade.amountUsdc : 5
            let shares = trade ? trade.shares : 0

            // Self-healing: if shares is equal to investedUsdc, estimate actual shares based on child pools
            if (shares === investedUsdc && child) {
              const yesPool = Number(child.usdcYesAmount ?? 0)
              const noPool = Number(child.usdcNoAmount ?? 0)
              const totalPool = yesPool + noPool
              let yesProb = 50
              if (totalPool > 0) {
                yesProb = (yesPool / totalPool) * 100
              }
              const noProb = 100 - yesProb
              const price = p.selection === "YES" ? yesProb / 100 : noProb / 100
              shares = investedUsdc / (price || 0.5)
            }

            const winningsUsdc = p.isCorrect === true ? shares : 0
            return {
              marketId: p.marketId.toString(),
              optionName: child?.optionName || "Unknown",
              selection: p.selection,
              isCorrect: p.isCorrect,
              yesCondition: child?.yesCondition || "YES",
              noCondition: child?.noCondition || "NO",
              resolvedOutcome: child?.resolvedOutcome || null,
              investedUsdc,
              winningsUsdc,
            }
          })
        : []

      const oppPicks = oppTicket
        ? oppTicket.picks.map((p: any) => {
            const child = children.find(
              (c: any) => c._id.toString() === p.marketId.toString(),
            )
            const trade = tradesMap.get(
              `${oppId.toString()}:${p.marketId.toString()}`,
            )
            const investedUsdc = trade ? trade.amountUsdc : 5
            let shares = trade ? trade.shares : 0

            // Self-healing: if shares is equal to investedUsdc, estimate actual shares based on child pools
            if (shares === investedUsdc && child) {
              const yesPool = Number(child.usdcYesAmount ?? 0)
              const noPool = Number(child.usdcNoAmount ?? 0)
              const totalPool = yesPool + noPool
              let yesProb = 50
              if (totalPool > 0) {
                yesProb = (yesPool / totalPool) * 100
              }
              const noProb = 100 - yesProb
              const price = p.selection === "YES" ? yesProb / 100 : noProb / 100
              shares = investedUsdc / (price || 0.5)
            }

            const winningsUsdc = p.isCorrect === true ? shares : 0
            return {
              marketId: p.marketId.toString(),
              optionName: child?.optionName || "Unknown",
              selection: p.selection,
              isCorrect: p.isCorrect,
              yesCondition: child?.yesCondition || "YES",
              noCondition: child?.noCondition || "NO",
              resolvedOutcome: child?.resolvedOutcome || null,
              investedUsdc,
              winningsUsdc,
            }
          })
        : []

      result.push({
        matchId: match._id.toString(),
        resolvedAt: match.resolvedAt,
        parentMarketId: match.parentMarketId.toString(),
        eventQuestion: parent?.question || "Match Event",
        outcome,
        myScore: myTicket?.score ?? 0,
        oppScore: oppTicket?.score ?? 0,
        xpEarned: myTicket?.xpEarned ?? 0,
        doubleBoostActive: myTicket?.doubleBoostActive ?? false,
        myPicks,
        oppPicks,
        opponent: oppUser
          ? {
              id: oppUser._id.toString(),
              username: oppUser.username,
              displayName: oppUser.displayName,
              avatarUrl: oppUser.avatarUrl,
            }
          : null,
      })
    }

    return result
  }

  async getClaimableWinnings(userId: string) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new NotFoundException("User not found.")

    // Limit to last 30 days for performance
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Find all resolved tickets for this user within the time window
    const resolvedTickets = await this.pvpTicketModel.find({
      userId: new Types.ObjectId(userId),
      status: "resolved",
      updatedAt: { $gte: thirtyDaysAgo },
    })

    if (resolvedTickets.length === 0) {
      return {
        claimableMarketIds: [],
        totalWinningsUsdc: 0,
        claimablePicks: [],
      }
    }

    // Collect all winning picks (isCorrect === true)
    const winningPicks: {
      marketId: Types.ObjectId
      parentMarketId: Types.ObjectId
      selection: string
    }[] = []

    for (const ticket of resolvedTickets) {
      for (const pick of ticket.picks) {
        if (pick.isCorrect === true) {
          winningPicks.push({
            marketId: pick.marketId,
            parentMarketId: ticket.parentMarketId,
            selection: pick.selection,
          })
        }
      }
    }

    if (winningPicks.length === 0) {
      return {
        claimableMarketIds: [],
        totalWinningsUsdc: 0,
        claimablePicks: [],
      }
    }

    // Deduplicate market IDs (user could have same child market across tickets, though unlikely)
    const uniqueMarketIds = [
      ...new Set(winningPicks.map((p) => p.marketId.toString())),
    ]

    // Fetch all relevant child markets and parent markets in parallel
    const uniqueParentIds = [
      ...new Set(winningPicks.map((p) => p.parentMarketId.toString())),
    ]
    const [childMarkets, parentMarkets] = await Promise.all([
      this.marketModel.find({
        _id: { $in: uniqueMarketIds.map((id) => new Types.ObjectId(id)) },
      }),
      this.marketModel.find({
        _id: { $in: uniqueParentIds.map((id) => new Types.ObjectId(id)) },
      }),
    ])

    const childMap = new Map<string, any>()
    for (const child of childMarkets) {
      childMap.set(child._id.toString(), child)
    }

    const parentMap = new Map<string, any>()
    for (const parent of parentMarkets) {
      parentMap.set(parent._id.toString(), parent)
    }

    // Verify on-chain balances to find truly claimable picks
    if (!user.walletAddress) {
      return {
        claimableMarketIds: [],
        totalWinningsUsdc: 0,
        claimablePicks: [],
      }
    }

    // Build batch queries for on-chain balance check
    // We only need the winning outcome's balance for each market
    const batchQueries: { marketId: string; outcomes: string[] }[] = []
    for (const marketIdStr of uniqueMarketIds) {
      const child = childMap.get(marketIdStr)
      if (!child) continue

      const outcomes =
        child.outcomes && child.outcomes.length > 0
          ? child.outcomes
          : ["YES", "NO"]
      batchQueries.push({ marketId: marketIdStr, outcomes })
    }

    let balancesMap: Record<string, Record<string, number>> = {}
    try {
      balancesMap = await this.blockchainService.getUserOnChainBalancesBatch(
        batchQueries,
        user.walletAddress,
      )
    } catch (err) {
      this.logger.error(
        `Failed to batch read on-chain balances for claimable winnings: ${err.message}`,
      )
      return {
        claimableMarketIds: [],
        totalWinningsUsdc: 0,
        claimablePicks: [],
      }
    }

    // Filter to only picks where the user still holds tokens on-chain
    const claimablePicks: any[] = []
    const claimableMarketIds: string[] = []
    let totalWinningsUsdc = 0

    for (const pick of winningPicks) {
      const marketIdStr = pick.marketId.toString()
      const child = childMap.get(marketIdStr)
      if (!child) continue

      const onChain = balancesMap[marketIdStr]
      if (!onChain) continue

      // Determine the normalized side for balance lookup
      const isMulti = child.outcomeCount && child.outcomeCount > 2
      let balance = 0

      if (isMulti) {
        balance = onChain[pick.selection] ?? 0
      } else {
        // For binary markets, map selection to outcome name for balance lookup
        const outcomes =
          child.outcomes && child.outcomes.length > 0
            ? child.outcomes
            : ["YES", "NO"]
        if (pick.selection === "YES") {
          balance = onChain[outcomes[0]] ?? 0
        } else if (pick.selection === "NO") {
          balance = onChain[outcomes[1]] ?? 0
        } else {
          balance = onChain[pick.selection] ?? 0
        }
      }

      if (balance > 0) {
        // Avoid duplicate market IDs in the final list
        if (!claimableMarketIds.includes(marketIdStr)) {
          claimableMarketIds.push(marketIdStr)
        }

        const parent = parentMap.get(pick.parentMarketId.toString())
        claimablePicks.push({
          marketId: marketIdStr,
          parentMarketId: pick.parentMarketId.toString(),
          eventQuestion: parent?.question || "PvP Event",
          optionName: child.optionName || child.question || "Unknown",
          selection: pick.selection,
          shares: balance,
        })
        totalWinningsUsdc += balance
      }
    }

    return {
      claimableMarketIds,
      totalWinningsUsdc,
      claimablePicks,
    }
  }

  async getAdminStatus(adminId: string) {
    const admin = await this.userModel.findById(adminId)
    if (!admin || admin.role !== "admin") {
      throw new ForbiddenException("Only admins can fetch admin status.")
    }

    const balances = await this.blockchainService.getAdminBalances()
    return {
      adminAddress: balances.address,
      arcBalance: balances.arcBalance,
      usdcBalance: balances.usdcBalance,
      preDepositUsdcPerOption: 40,
      creationFeeUsdc: 1,
    }
  }

  async getAdminMetrics(adminId: string) {
    const admin = await this.userModel.findById(adminId)
    if (!admin || admin.role !== "admin") {
      throw new ForbiddenException("Only admins can fetch admin metrics.")
    }

    const botUsernames = BOT_PROFILES.map((b) => b.username)

    // 1. Users count
    const totalUsers = await this.userModel.countDocuments()
    const botsCount = await this.userModel.countDocuments({
      username: { $in: botUsernames },
    })
    const realUsersCount = Math.max(0, totalUsers - botsCount)

    // 2. PvP User Stats
    const tickets = await this.pvpTicketModel
      .find({}, { userId: 1, status: 1 })
      .lean()
    const ticketUserIds = [...new Set(tickets.map((t) => t.userId.toString()))]
    const ticketUsers = await this.userModel
      .find({ _id: { $in: ticketUserIds } }, { username: 1 })
      .lean()

    const botUserIdsSet = new Set(
      ticketUsers
        .filter((u) => botUsernames.includes(u.username))
        .map((u) => u._id.toString()),
    )

    let realUsersSubmittedCount = 0
    let botUsersSubmittedCount = 0
    let realUsersPlayedCount = 0
    let botUsersPlayedCount = 0

    const uniqueUsersWithTicketsAll = new Set<string>()
    const uniqueUsersWithMatchedTickets = new Set<string>()

    for (const t of tickets) {
      const uIdStr = t.userId.toString()
      uniqueUsersWithTicketsAll.add(uIdStr)
      if (["matched", "resolved"].includes(t.status)) {
        uniqueUsersWithMatchedTickets.add(uIdStr)
      }
    }

    for (const uid of uniqueUsersWithTicketsAll) {
      if (botUserIdsSet.has(uid)) {
        botUsersSubmittedCount++
      } else {
        realUsersSubmittedCount++
      }
    }

    for (const uid of uniqueUsersWithMatchedTickets) {
      if (botUserIdsSet.has(uid)) {
        botUsersPlayedCount++
      } else {
        realUsersPlayedCount++
      }
    }

    // 3. Count PvP Matches
    const totalPvpMatches = await this.pvpMatchModel.countDocuments()

    // 4. Sum USDC volume and fees from MarketTrades
    const trades = await this.marketTradeModel
      .find({}, { amountUsdc: 1, feeUsdc: 1, marketId: 1 })
      .lean()
    const marketsList = await this.marketModel
      .find({}, { category: 1, creationFeeTxHash: 1, marketCreationFeeUsdc: 1 })
      .lean()
    const marketMap = new Map(marketsList.map((m) => [m._id.toString(), m]))

    let totalVolume = 0
    let totalFees = 0
    let pvpVolume = 0
    let pvpFees = 0
    let standardVolume = 0
    let standardFees = 0

    for (const trade of trades) {
      const amount = Number(trade.amountUsdc || 0)
      const fee = Number(trade.feeUsdc || 0)

      totalVolume += amount
      totalFees += fee

      const mId = trade.marketId.toString()
      const market = marketMap.get(mId)
      if (market && market.category === "pvp") {
        pvpVolume += amount
        pvpFees += fee
      } else {
        standardVolume += amount
        standardFees += fee
      }
    }

    let creationFeesCollected = 0
    for (const market of marketsList) {
      if (market.creationFeeTxHash) {
        creationFeesCollected += Number(market.marketCreationFeeUsdc || 0)
      }
    }

    return {
      users: {
        total: totalUsers,
        real: realUsersCount,
        bots: botsCount,
      },
      pvpUsers: {
        submitted: {
          total: uniqueUsersWithTicketsAll.size,
          real: realUsersSubmittedCount,
          bots: botUsersSubmittedCount,
        },
        played: {
          total: uniqueUsersWithMatchedTickets.size,
          real: realUsersPlayedCount,
          bots: botUsersPlayedCount,
        },
      },
      pvpMatchesCount: totalPvpMatches,
      volumeAndFees: {
        overallVolume: totalVolume,
        overallFees: totalFees,
        standardVolume,
        standardFees,
        pvpVolume,
        pvpFees,
        creationFeesCollected,
        combinedFees: totalFees + creationFeesCollected,
      },
    }
  }
}
