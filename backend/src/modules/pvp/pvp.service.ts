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
} from "../markets/markets.model"
import { Post, PostDocument } from "../posts/posts.model"
import { SocketGateway } from "../socket/socket.gateway"
import { NotificationsService } from "../notifications/notifications.service"
import { CreatePvpEventDto, SubmitTicketDto } from "./pvp.dto"
import { BlockchainService } from "../blockchain/blockchain.service"
import { LiquidityService } from "../liquidity/liquidity.service"

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
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly blockchainService: BlockchainService,
    private readonly liquidityService: LiquidityService,
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
      parentMarket = await this.marketModel.create({
        postId: post._id,
        authorId: new Types.ObjectId(adminId),
        question: dto.question.trim(),
        category: "pvp",
        deadline: new Date(dto.deadline),
        resolutionSource: dto.resolutionSource.trim(),
        yesCondition: teamA,
        noCondition: teamB,
        status: "tradable",
        marketType: "parent",
      })

      // 3. Create exactly 7 Child Markets and Register/Fund them on-chain
      const childMarkets: MarketDocument[] = []
      const deadlineUnix = Math.floor(new Date(dto.deadline).getTime() / 1000)
      const now = new Date()
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const fundingDeadline =
        new Date(dto.deadline) < sevenDaysFromNow
          ? new Date(dto.deadline)
          : sevenDaysFromNow
      const fundingDeadlineUnix = Math.floor(fundingDeadline.getTime() / 1000)

      for (let i = 0; i < dto.options.length; i++) {
        const optionName = dto.options[i]
        const child = await this.marketModel.create({
          postId: post._id,
          authorId: new Types.ObjectId(adminId),
          question: `${dto.question.trim()} - ${optionName.trim()}`,
          category: "pvp",
          deadline: new Date(dto.deadline),
          resolutionSource: dto.resolutionSource.trim(),
          yesCondition: teamA,
          noCondition: teamB,
          status: "funding_pool", // temporary status while funding
          marketType: "child",
          parentMarketId: parentMarket._id,
          optionName: optionName.trim(),
          teamName: teamA, // Keep teamA as primary associated team
        })
        childMarketIds.push(child._id)

        // Pre-deposit 40 USDC on-chain
        const preDepositTxHash =
          await this.blockchainService.adminCreateMarketPreDeposit(
            child._id.toString(),
            40,
          )

        // Register on-chain
        try {
          await this.blockchainService.registerMarket(
            child._id.toString(),
            adminWalletAddress,
            deadlineUnix,
            fundingDeadlineUnix,
          )
        } catch (error) {
          const msg = error?.message || ""
          if (!msg.includes("MarketAlreadyRegistered")) {
            throw error
          }
        }

        // Initialize database pool from pre-deposit (which will sync and transition status to "tradable")
        await this.liquidityService.initializePoolFromPreDeposit(
          child._id.toString(),
          adminId,
          adminWalletAddress,
          preDepositTxHash,
          40,
        )

        const updatedChild = await this.marketModel.findById(child._id)
        if (updatedChild) {
          childMarkets.push(updatedChild)
        } else {
          childMarkets.push(child)
        }
      }

      this.logger.log(
        `Admin ${adminId} successfully deployed PvP Event: ${parentMarket._id} with 7 child options and pre-deposited USDC.`,
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

  async getActiveEvents() {
    const now = new Date()
    // Find parent markets of category "pvp" which haven't expired or resolved yet
    const parents = await this.marketModel
      .find({
        category: "pvp",
        marketType: "parent",
        deadline: { $gt: now },
        status: { $ne: "resolved" },
      })
      .sort({ deadline: 1 })

    const result: any[] = []
    for (const parent of parents) {
      const children = await this.marketModel.find({
        parentMarketId: parent._id,
        marketType: "child",
      })
      result.push({
        id: parent._id.toString(),
        question: parent.question,
        deadline: parent.deadline,
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

    if (new Date() >= parent.deadline) {
      throw new BadRequestException(
        "Event deadline has passed. Predictions are locked.",
      )
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

    // Consume double boost if remaining > 0
    let doubleBoostActive = false
    if (user.doubleBoostRemaining > 0) {
      user.doubleBoostRemaining -= 1
      await user.save()
      doubleBoostActive = true
      this.logger.log(
        `User ${userId} consumed a double boost. remaining: ${user.doubleBoostRemaining}`,
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
      `You've been matched against @${u2Name} for the event with a selection divergence of ${maxDivergence}/7.`,
      match._id.toString(),
    )
    await this.notificationsService.createNotification(
      bestOpponent.userId.toString(),
      ticket.userId.toString(),
      "pvp_matched",
      "PvP Arena Opponent Found!",
      `You've been matched against @${u1Name} for the event with a selection divergence of ${maxDivergence}/7.`,
      match._id.toString(),
    )

    this.logger.log(
      `Matched tickets: ${ticket._id} and ${bestOpponent._id} inside match: ${match._id}`,
    )
    return match
  }

  async resolvePvpMatchesForMarket(
    marketId: string,
    winningOutcome: "YES" | "NO",
  ) {
    // Find all matched tickets containing this child market
    const tickets = await this.pvpTicketModel.find({
      status: "matched",
      "picks.marketId": new Types.ObjectId(marketId),
    })

    if (tickets.length === 0) return

    this.logger.log(
      `Resolving child market ${marketId} outcome: ${winningOutcome} on ${tickets.length} PvP tickets.`,
    )

    for (const ticket of tickets) {
      let updated = false
      for (const pick of ticket.picks) {
        if (pick.marketId.toString() === marketId) {
          pick.isCorrect = pick.selection === winningOutcome
          updated = true
        }
      }

      if (updated) {
        ticket.markModified("picks")
        await ticket.save()

        // Check if all 7 picks are resolved
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

    // 1. Calculate scores
    const correct1 = ticket1.picks.filter((p) => p.isCorrect === true).length
    const wrong1 = 7 - correct1
    let score1 = correct1 * 70 + wrong1 * 30
    if (correct1 === 7) score1 += 100 // Perfect Game bonus

    const correct2 = ticket2.picks.filter((p) => p.isCorrect === true).length
    const wrong2 = 7 - correct2
    let score2 = correct2 * 70 + wrong2 * 30
    if (correct2 === 7) score2 += 100 // Perfect Game bonus

    // 2. Determine Winner/Loser with Lock-in Tie-Breaker
    let winnerId: Types.ObjectId | null = null
    if (score1 > score2) {
      winnerId = match.user1Id
    } else if (score2 > score1) {
      winnerId = match.user2Id
    } else {
      // Tie breaker: Lock-in time
      const time1 = ticket1.createdAt
        ? new Date(ticket1.createdAt).getTime()
        : 0
      const time2 = ticket2.createdAt
        ? new Date(ticket2.createdAt).getTime()
        : 0
      if (time1 < time2) {
        winnerId = match.user1Id
      } else if (time2 < time1) {
        winnerId = match.user2Id
      } else {
        // True draw (extremely rare but possible)
        winnerId = null
      }
    }

    // 3. Load Users
    const [user1, user2] = await Promise.all([
      this.userModel.findById(match.user1Id),
      this.userModel.findById(match.user2Id),
    ])
    if (!user1 || !user2) return

    // 4. Calculate ELO Changes (K = 32)
    const elo1 = user1.eloRating ?? 1000
    const elo2 = user2.eloRating ?? 1000
    const exp1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400))
    const exp2 = 1 / (1 + Math.pow(10, (elo1 - elo2) / 400))

    let s1 = 0.5
    let s2 = 0.5
    if (winnerId) {
      if (winnerId.toString() === user1._id.toString()) {
        s1 = 1
        s2 = 0
      } else {
        s1 = 0
        s2 = 1
      }
    }

    const dRating1 = Math.round(32 * (s1 - exp1))
    const dRating2 = Math.round(32 * (s2 - exp2))

    // 5. Award XP (including double boost if active)
    const xp1 = score1 * (ticket1.doubleBoostActive ? 2 : 1)
    const xp2 = score2 * (ticket2.doubleBoostActive ? 2 : 1)

    // 6. Update user stats
    user1.eloRating = Math.max(100, elo1 + dRating1)
    user2.eloRating = Math.max(100, elo2 + dRating2)
    user1.arenaXp += xp1
    user2.arenaXp += xp2

    user1.pvpTicketsSubmittedCount += 1
    user2.pvpTicketsSubmittedCount += 1

    if (winnerId) {
      if (winnerId.toString() === user1._id.toString()) {
        user1.pvpMatchesWonCount += 1
        user2.pvpMatchesLostCount += 1

        // Co-Op First Win Boost (Referee + Referrer gets +2 double boosts)
        if (!user1.hasWonFirstPvpDuel) {
          user1.hasWonFirstPvpDuel = true
          if (user1.referredById) {
            await this.awardFirstWinBoosts(user1)
          }
        }
      } else {
        user2.pvpMatchesWonCount += 1
        user1.pvpMatchesLostCount += 1

        if (!user2.hasWonFirstPvpDuel) {
          user2.hasWonFirstPvpDuel = true
          if (user2.referredById) {
            await this.awardFirstWinBoosts(user2)
          }
        }
      }
    } else {
      user1.pvpMatchesDrawnCount += 1
      user2.pvpMatchesDrawnCount += 1
    }

    // 7. Referral XP Kickback (5%)
    let kickback1 = 0
    let kickback2 = 0
    if (user1.referredById) {
      kickback1 = Math.round(xp1 * 0.05)
      await this.userModel.findByIdAndUpdate(user1.referredById, {
        $inc: { arenaXp: kickback1 },
      })
      this.logger.log(
        `Referral Kickback of ${kickback1} XP awarded to referrer of user ${user1._id}`,
      )
    }
    if (user2.referredById) {
      kickback2 = Math.round(xp2 * 0.05)
      await this.userModel.findByIdAndUpdate(user2.referredById, {
        $inc: { arenaXp: kickback2 },
      })
      this.logger.log(
        `Referral Kickback of ${kickback2} XP awarded to referrer of user ${user2._id}`,
      )
    }

    // Save users
    await Promise.all([user1.save(), user2.save()])

    // 8. Update Match and Ticket records
    match.status = "resolved"
    match.winnerId = winnerId
    match.resolvedAt = new Date()
    await match.save()

    ticket1.status = "resolved"
    ticket1.score = score1
    ticket1.xpEarned = xp1
    ticket1.eloChange = dRating1
    await ticket1.save()

    ticket2.status = "resolved"
    ticket2.score = score2
    ticket2.xpEarned = xp2
    ticket2.eloChange = dRating2
    await ticket2.save()

    // Broadcast Socket events
    this.socketGateway.broadcastToRoom(
      `user:${user1._id.toString()}`,
      "pvp-resolved",
      { matchId: match._id.toString() },
    )
    this.socketGateway.broadcastToRoom(
      `user:${user2._id.toString()}`,
      "pvp-resolved",
      { matchId: match._id.toString() },
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
      `Your battle against @${u2} resolved. Score: ${score1} vs ${score2}. Elo: ${dRating1 > 0 ? `+${dRating1}` : dRating1} (New ELO: ${user1.eloRating}). XP Earned: +${xp1}.`,
      match._id.toString(),
    )
    await this.notificationsService.createNotification(
      user2._id.toString(),
      user1._id.toString(),
      "pvp_resolved",
      `PvP Duel Resolved: You ${res2}`,
      `Your battle against @${u1} resolved. Score: ${score2} vs ${score1}. Elo: ${dRating2 > 0 ? `+${dRating2}` : dRating2} (New ELO: ${user2.eloRating}). XP Earned: +${xp2}.`,
      match._id.toString(),
    )
  }

  private async awardFirstWinBoosts(referee: UserDocument) {
    const referrer = await this.userModel.findById(referee.referredById)
    if (!referrer) return

    // Increment double boosts by 2 for both referee and referrer
    referee.doubleBoostRemaining = (referee.doubleBoostRemaining ?? 0) + 2
    referrer.doubleBoostRemaining = (referrer.doubleBoostRemaining ?? 0) + 2
    await referrer.save()

    // Send notifications
    await this.notificationsService.createNotification(
      referee._id.toString(),
      referrer._id.toString(),
      "pvp_boost",
      "Co-Op Double Boost Active! ⚡",
      `Congratulations on your first win! You and your referrer @${referrer.username} both got 2 Double-Boosts (2x XP).`,
      referee._id.toString(),
    )
    await this.notificationsService.createNotification(
      referrer._id.toString(),
      referee._id.toString(),
      "pvp_boost",
      "Referral Double Boost Awarded! ⚡",
      `Your referred friend @${referee.username} won their first duel! You both got 2 Double-Boosts (2x XP).`,
      referrer._id.toString(),
    )

    this.logger.log(
      `Co-Op double boosts (+2) awarded to referee ${referee._id} and referrer ${referrer._id}`,
    )
  }

  async getPvpStatus(userId: string) {
    // Find the latest active ticket (either queued or matched)
    const ticket = await this.pvpTicketModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ["queued", "matched"] },
      })
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

    // Fetch the user's on-chain positions for all child markets (same as normal markets)
    const childMarketIds = children.map((c) => c._id)
    const userPositions = await this.marketPositionModel.find({
      userId: new Types.ObjectId(userId),
      marketId: { $in: childMarketIds },
      shares: { $gt: 0 },
    })

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
            eloRating: opponent.eloRating ?? 1000,
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
            options: children.map((c) => ({
              id: c._id.toString(),
              optionName: c.optionName || c.question,
              yesCondition: c.yesCondition || "YES",
              noCondition: c.noCondition || "NO",
            })),
          }
        : null,
    }
  }

  async getLeaderboards() {
    // ELO (Skill)
    const eloList = await this.userModel
      .find({
        isOnboarded: true,
      })
      .sort({ eloRating: -1 })
      .limit(50)

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
      elo: eloList.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        eloRating: u.eloRating ?? 1000,
      })),
      xp: xpList.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        arenaXp: u.arenaXp ?? 0,
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

    // Calculate total kickback XP generated (roughly 5% of referee's ELO/XP if we just display the count or compute it from matches)
    // We can count their referees, double boost remaining, etc.
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

      result.push({
        matchId: match._id.toString(),
        resolvedAt: match.resolvedAt,
        parentMarketId: match.parentMarketId.toString(),
        eventQuestion: parent?.question || "Match Event",
        outcome,
        myScore: myTicket?.score ?? 0,
        oppScore: oppTicket?.score ?? 0,
        xpEarned: myTicket?.xpEarned ?? 0,
        eloChange: myTicket?.eloChange ?? 0,
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
}
