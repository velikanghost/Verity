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
    return "cards"
  }

  if (name.includes("corner") || name.includes("corners")) {
    return "corners"
  }

  if (name.includes("goals") || name.includes("goal")) {
    return "goals"
  }

  return `unique_${optionName.replace(/\s+/g, "_").toLowerCase()}`
}

@Injectable()
export class PvpService {
  private readonly logger = new Logger(PvpService.name)

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
      const lockTime = dto.lockTime ? new Date(dto.lockTime) : new Date(dto.deadline)
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
        const outcomeCount =
          groupOptions.length === 1 ? 2 : groupOptions.length

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
        if (optionGroup === "spread" || optionGroup === "totals") {
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
    if (!parent || parent.marketType !== "parent" || parent.category !== "pvp") {
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

    this.logger.log(`Admin ${adminId} successfully locked PvP Event: ${parentMarketId}`)

    this.socketGateway.broadcastToRoom("feed", "feed-updated", {})
    return { success: true }
  }

  async getActiveEvents() {
    const parents = await this.marketModel
      .find({
        category: "pvp",
        marketType: "parent",
        status: { $ne: "resolved" },
      })
      .sort({ deadline: 1 })

    const result: any[] = []
    for (const parent of parents) {
      const children = await this.marketModel.find({
        parentMarketId: parent._id,
        marketType: "child",
      })

      const childIds = children.map((c) => c._id)
      const trades = await this.marketTradeModel.find({
        marketId: { $in: childIds },
      })

      const volumeMap: Record<string, number> = {}
      for (const t of trades) {
        const idStr = t.marketId.toString()
        volumeMap[idStr] = (volumeMap[idStr] || 0) + Number(t.amountUsdc || 0)
      }

      result.push({
        id: parent._id.toString(),
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
          volume: volumeMap[c._id.toString()] || 0,
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
    // 1. Find queued or matched tickets
    const activeTickets = await this.pvpTicketModel.find({
      userId: new Types.ObjectId(userId),
      status: { $in: ["queued", "matched"] },
    })

    // 2. Find user positions with shares > 0
    const activePositions = await this.marketPositionModel.find({
      userId: new Types.ObjectId(userId),
      shares: { $gt: 0 },
    })

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

    const result: any[] = []
    for (const pid of parentIds) {
      const parent = await this.marketModel.findById(pid)
      if (!parent) continue

      const children = await this.marketModel.find({
        parentMarketId: parent._id,
        marketType: "child",
      })

      const childIds = children.map((c) => c._id)
      const trades = await this.marketTradeModel.find({
        marketId: { $in: childIds },
      })

      const volumeMap: Record<string, number> = {}
      for (const t of trades) {
        const idStr = t.marketId.toString()
        volumeMap[idStr] = (volumeMap[idStr] || 0) + Number(t.amountUsdc || 0)
      }

      result.push({
        id: parent._id.toString(),
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
          volume: volumeMap[c._id.toString()] || 0,
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

    // Consume an XP boost if remaining > 0.
    let doubleBoostActive = false
    if (user.doubleBoostRemaining > 0) {
      user.doubleBoostRemaining -= 1
      await user.save()
      doubleBoostActive = true
      this.logger.log(
        `User ${userId} consumed an XP boost. remaining: ${user.doubleBoostRemaining}`,
      )
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
    })

    // Perform matchmaking
    const match = await this.matchmake(ticket)

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

    if (!bestOpponent) return null

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
    // Find all matched tickets containing this child market
    const tickets = await this.pvpTicketModel.find({
      status: "matched",
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
          const isStringMatch =
            pick.selection.toLowerCase().trim() ===
            winningOutcome.toLowerCase().trim()

          let isIndexMatch = false
          if (market && market.outcomes && market.outcomes.length > 0) {
            const selIdx = market.outcomes.findIndex(
              (o) =>
                o.toLowerCase().trim() === pick.selection.toLowerCase().trim(),
            )
            const winIdx = market.outcomes.findIndex(
              (o) =>
                o.toLowerCase().trim() === winningOutcome.toLowerCase().trim(),
            )
            if (selIdx >= 0 && winIdx >= 0 && selIdx === winIdx) {
              isIndexMatch = true
            }
          }

          pick.isCorrect = isStringMatch || isIndexMatch
          updated = true

          // Delete losing position immediately so they don't clutter the active ticket list
          if (!pick.isCorrect) {
            await this.marketPositionModel.deleteOne({
              marketId: pick.marketId,
              userId: ticket.userId,
              side: pick.selection,
            })
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

    // 2. Equal accuracy is a draw.
    const accuracy1 =
      ticket1.picks.length > 0 ? score1 / ticket1.picks.length : 0
    const accuracy2 =
      ticket2.picks.length > 0 ? score2 / ticket2.picks.length : 0

    let winnerId: Types.ObjectId | null = null
    if (accuracy1 > accuracy2) {
      winnerId = match.user1Id
    } else if (accuracy2 > accuracy1) {
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

    // 4. Award Result XP, a +20 perfect bonus, and an optional 1.2x boost.
    const xp1 = calculatePvpResultXp(
      result1,
      score1,
      ticket1.picks.length,
      ticket1.doubleBoostActive,
    )
    const xp2 = calculatePvpResultXp(
      result2,
      score2,
      ticket2.picks.length,
      ticket2.doubleBoostActive,
    )

    // 5. Update user stats
    user1.arenaXp += xp1
    user2.arenaXp += xp2

    user1.pvpTicketsSubmittedCount += 1
    user2.pvpTicketsSubmittedCount += 1

    if (winnerId) {
      if (winnerId.toString() === user1._id.toString()) {
        user1.pvpMatchesWonCount += 1
        user2.pvpMatchesLostCount += 1

        // A referred player's first win grants two boosts to their referrer.
        if (!user1.hasWonFirstPvpDuel) {
          user1.hasWonFirstPvpDuel = true
          if (user1.referredById) {
            await this.awardReferrerFirstWinBoosts(user1)
          }
        }
      } else {
        user2.pvpMatchesWonCount += 1
        user1.pvpMatchesLostCount += 1

        if (!user2.hasWonFirstPvpDuel) {
          user2.hasWonFirstPvpDuel = true
          if (user2.referredById) {
            await this.awardReferrerFirstWinBoosts(user2)
          }
        }
      }
    } else {
      user1.pvpMatchesDrawnCount += 1
      user2.pvpMatchesDrawnCount += 1
    }

    // Save users
    await Promise.all([user1.save(), user2.save()])

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

    await this.notificationsService.createNotification(
      user1._id.toString(),
      user2._id.toString(),
      "pvp_resolved",
      `PvP Duel Resolved: You ${res1}`,
      `Your battle against @${u2} resolved. Score: ${score1}/${ticket1.picks.length} vs ${score2}/${ticket2.picks.length}. Arena XP earned: +${xp1}.`,
      match._id.toString(),
    )
    await this.notificationsService.createNotification(
      user2._id.toString(),
      user1._id.toString(),
      "pvp_resolved",
      `PvP Duel Resolved: You ${res2}`,
      `Your battle against @${u1} resolved. Score: ${score2}/${ticket2.picks.length} vs ${score1}/${ticket1.picks.length}. Arena XP earned: +${xp2}.`,
      match._id.toString(),
    )
  }

  private async awardReferrerFirstWinBoosts(referredPlayer: UserDocument) {
    const referrer = await this.userModel.findById(referredPlayer.referredById)
    if (!referrer) return

    // Keep the existing field name for database compatibility.
    referrer.doubleBoostRemaining = (referrer.doubleBoostRemaining ?? 0) + 2
    await referrer.save()

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
    const ticket = await this.pvpTicketModel
      .findOne(query)
      .sort({ createdAt: -1 })

    if (!ticket) return null

    let match: PvpMatchDocument | null = null
    let opponent: UserDocument | null = null
    let opponentTicket: PvpTicketDocument | null = null
    if (ticket.matchId) {
      match = await this.pvpMatchModel.findById(ticket.matchId)
      if (match) {
        opponentTicket = await this.pvpTicketModel.findById(
          ticket.opponentTicketId,
        )
        opponent = await this.userModel.findById(opponentTicket?.userId)
      }
    }

    const parent = await this.marketModel.findById(ticket.parentMarketId)
    const children = await this.marketModel.find({
      parentMarketId: ticket.parentMarketId,
    })

    const user = await this.userModel.findById(userId)
    if (user && user.walletAddress) {
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
          user.walletAddress,
        )
      } catch (err) {
        this.logger.error(
          `Error syncing position batch in getPvpStatus: ${err.message}`,
        )
      }

      for (const child of children) {
        try {
          const outcomes =
            child.outcomes && child.outcomes.length > 0
              ? child.outcomes
              : ["YES", "NO"]

          const onChain = balancesMap[child._id.toString()] || {}

          const isResolved =
            child.status === "resolved" || child.resolvedOutcome
          const winningOutcome = child.resolvedOutcome
          const isMulti = child.outcomeCount && child.outcomeCount > 2

          for (let idx = 0; idx < outcomes.length; idx++) {
            const outcome = outcomes[idx]
            const normalizedSide = isMulti ? outcome : idx === 0 ? "YES" : "NO"

            const balance = onChain[outcome] ?? 0
            const isLosing = isResolved && winningOutcome !== normalizedSide

            if (!isLosing && balance > 0) {
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
            } else {
              await this.marketPositionModel.deleteOne({
                marketId: child._id,
                userId: new Types.ObjectId(userId),
                side: normalizedSide,
              })
            }
          }
        } catch (err) {
          this.logger.error(
            `Error syncing position in getPvpStatus for child ${child._id}: ${err.message}`,
          )
        }
      }
    }

    // Fetch the user's on-chain positions for all child markets (same as normal markets)
    const childMarketIds = children.map((c) => c._id)
    const [userPositions, childTrades] = await Promise.all([
      this.marketPositionModel.find({
        userId: new Types.ObjectId(userId),
        marketId: { $in: childMarketIds },
        shares: { $gt: 0 },
      }),
      this.marketTradeModel.find({
        marketId: { $in: childMarketIds },
      }),
    ])

    const volumeMap: Record<string, number> = {}
    for (const t of childTrades) {
      const idStr = t.marketId.toString()
      volumeMap[idStr] = (volumeMap[idStr] || 0) + Number(t.amountUsdc || 0)
    }

    return {
      status: ticket.status,
      ticket: {
        id: ticket._id.toString(),
        status: ticket.status,
        score: ticket.score,
        xpEarned: ticket.xpEarned,
        doubleBoostActive: ticket.doubleBoostActive,
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

  async getLeaderboards() {
    // XP (Volume)
    const xpList = await this.userModel
      .find({
        isOnboarded: true,
      })
      .sort({ arenaXp: -1 })
      .limit(50)

    // Referrers (Total Referrals Count)
    // We can run an aggregation to find referrers ranked by number of referee users
    const referrerRankings = await this.userModel.aggregate([
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
    ])

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
    }
  }

  async getReferrals(userId: string) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new NotFoundException("User not found.")

    const referees = await this.userModel
      .find({
        referredById: new Types.ObjectId(userId),
      })
      .sort({ arenaXp: -1 })

    return {
      referralLink: user.username,
      doubleBoostRemaining: user.doubleBoostRemaining ?? 0,
      hasWonFirstPvpDuel: user.hasWonFirstPvpDuel ?? false,
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

    const result: any[] = []
    for (const match of matches) {
      const parent = await this.marketModel.findById(match.parentMarketId)

      const isUser1 = match.user1Id.toString() === userId
      const myTicketId = isUser1 ? match.ticket1Id : match.ticket2Id
      const oppTicketId = isUser1 ? match.ticket2Id : match.ticket1Id
      const oppId = isUser1 ? match.user2Id : match.user1Id

      const [myTicket, oppTicket, oppUser] = await Promise.all([
        this.pvpTicketModel.findById(myTicketId),
        this.pvpTicketModel.findById(oppTicketId),
        this.userModel.findById(oppId),
      ])

      let outcome: "WIN" | "LOSS" | "DRAW" = "DRAW"
      if (match.winnerId) {
        outcome = match.winnerId.toString() === userId ? "WIN" : "LOSS"
      }

      // Fetch children child options for this parent event
      const children = await this.marketModel.find({
        parentMarketId: match.parentMarketId,
        marketType: "child",
      })

      // Fetch user's and opponent's trades on these child markets to figure out how much they bet/earned
      const childMarketIds = children.map((c) => c._id)
      const [myTrades, oppTrades] = await Promise.all([
        this.marketTradeModel.find({
          userId: uId,
          marketId: { $in: childMarketIds },
          action: "BUY",
        }),
        this.marketTradeModel.find({
          userId: oppId,
          marketId: { $in: childMarketIds },
          action: "BUY",
        }),
      ])

      const myPicks = myTicket
        ? myTicket.picks.map((p) => {
            const child = children.find(
              (c) => c._id.toString() === p.marketId.toString(),
            )
            const trade = myTrades.find(
              (t) => t.marketId.toString() === p.marketId.toString(),
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
        ? oppTicket.picks.map((p) => {
            const child = children.find(
              (c) => c._id.toString() === p.marketId.toString(),
            )
            const trade = oppTrades.find(
              (t) => t.marketId.toString() === p.marketId.toString(),
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

  async syncUnresolvedPvpPicks() {
    this.logger.log("Running self-healing syncUnresolvedPvpPicks...")
    // Find all matched tickets
    const tickets = await this.pvpTicketModel.find({
      status: "matched",
    })

    if (tickets.length === 0) return

    for (const ticket of tickets) {
      let updated = false
      for (const pick of ticket.picks) {
        if (pick.isCorrect === null) {
          const market = await this.marketModel.findById(pick.marketId)
          if (
            market &&
            market.status === "resolved" &&
            market.resolvedOutcome
          ) {
            pick.isCorrect = pick.selection === market.resolvedOutcome
            updated = true
            this.logger.log(
              `Self-healing pick resolution for market ${pick.marketId.toString()} on ticket ${ticket._id.toString()} -> isCorrect: ${pick.isCorrect}`,
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
}
