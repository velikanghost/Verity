import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import { User, UserDocument } from "../users/users.model"
import { Mission, MissionDocument } from "./missions.model"
import { CreateMissionDto, UpdateMissionDto } from "./missions.dto"
import { Vote } from "../markets/markets.model"
import { MarketTrade } from "../markets/markets.model"
import { Comment } from "../comments/comments.model"
import { Like } from "../interactions/interactions.model"
import { LPPosition } from "../liquidity/liquidity.model"
import { Post } from "../posts/posts.model"
import { TwitterVerifyService } from "./twitter-verify.service"

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name)

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Mission.name)
    private readonly missionModel: Model<MissionDocument>,
    @InjectModel(Vote.name) private readonly voteModel: Model<Vote>,
    @InjectModel(MarketTrade.name)
    private readonly marketTradeModel: Model<MarketTrade>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(Like.name) private readonly likeModel: Model<Like>,
    @InjectModel(LPPosition.name)
    private readonly lpPositionModel: Model<LPPosition>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    private readonly twitterVerifyService: TwitterVerifyService,
  ) {}

  async getMissions(userId: string, admin = false) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new NotFoundException("User not found.")

    const query = admin ? {} : { isActive: true }
    const missions = await this.missionModel.find(query).sort({ createdAt: -1 })

    const completedSet = new Set(user.completedMissions || [])

    return missions.map((m) => {
      const missionObj = m.toObject()
      return {
        id: missionObj._id.toString(),
        title: missionObj.title,
        xpReward: missionObj.xpReward,
        actionUrl: missionObj.actionUrl,
        isActive: missionObj.isActive,
        missionType: missionObj.missionType || "social",
        verificationKey: missionObj.verificationKey || null,
        rewardMultiplier: missionObj.rewardMultiplier ?? null,
        rewardMatchesCount: missionObj.rewardMatchesCount ?? null,
        completed: completedSet.has(missionObj._id.toString()),
      }
    })
  }

  async linkTwitterUsername(userId: string, twitterUsername: string) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new NotFoundException("User not found.")

    const cleanUsername = twitterUsername.trim().replace(/^@/, "")
    if (!cleanUsername) {
      throw new BadRequestException("Twitter username cannot be empty.")
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: { twitterUsername: cleanUsername } },
      { new: true },
    )

    this.logger.log(
      `Linked Twitter/X handle @${cleanUsername} for user ${user.username} (${userId})`,
    )

    return {
      twitterUsername: updatedUser?.twitterUsername || null,
    }
  }

  async completeMission(userId: string, missionId: string) {
    const user = await this.userModel.findById(userId)
    if (!user) throw new NotFoundException("User not found.")

    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException("Invalid mission ID format.")
    }

    const mission = await this.missionModel.findById(missionId)
    if (!mission || !mission.isActive) {
      throw new NotFoundException("Mission not found or inactive.")
    }

    const completedMissions = user.completedMissions || []
    if (completedMissions.includes(missionId)) {
      throw new BadRequestException("Mission already completed.")
    }

    // Perform verification checks
    if (mission.verificationKey) {
      const missionCreatedAt = mission.createdAt || new Date(0)

      if (mission.missionType === "activity") {
        switch (mission.verificationKey) {
          case "has_voted": {
            const hasVoted = await this.voteModel.findOne({
              userId: new Types.ObjectId(userId),
              createdAt: { $gt: missionCreatedAt },
            })
            if (!hasVoted) {
              throw new BadRequestException("You must place a vote first.")
            }
            break
          }
          case "has_commented": {
            const hasCommented = await this.commentModel.findOne({
              authorId: new Types.ObjectId(userId),
              createdAt: { $gt: missionCreatedAt },
            })
            if (!hasCommented) {
              throw new BadRequestException("You must post a comment first.")
            }
            break
          }
          case "has_liked": {
            const hasLiked = await this.likeModel.findOne({
              userId: new Types.ObjectId(userId),
              createdAt: { $gt: missionCreatedAt },
            })
            if (!hasLiked) {
              throw new BadRequestException("You must like a post first.")
            }
            break
          }
          case "has_traded": {
            const hasTraded = await this.marketTradeModel.findOne({
              userId: new Types.ObjectId(userId),
              action: "BUY",
              createdAt: { $gt: missionCreatedAt },
            })
            if (!hasTraded) {
              throw new BadRequestException(
                "You must place a trade (buy share) first.",
              )
            }
            break
          }
          case "has_added_liquidity": {
            const hasLP = await this.lpPositionModel.findOne({
              userId: new Types.ObjectId(userId),
              createdAt: { $gt: missionCreatedAt },
            })
            if (!hasLP) {
              throw new BadRequestException("You must add liquidity first.")
            }
            break
          }
          case "has_created_market": {
            const hasCreatedMarket = await this.postModel.findOne({
              authorId: new Types.ObjectId(userId),
              type: "market",
              createdAt: { $gt: missionCreatedAt },
            })
            if (!hasCreatedMarket) {
              throw new BadRequestException("You must create a market first.")
            }
            break
          }
          case "has_set_profile": {
            if (!user.isOnboarded) {
              throw new BadRequestException(
                "Please complete your profile onboarding first.",
              )
            }
            break
          }
          default:
            throw new BadRequestException(
              `Unknown verification key: ${mission.verificationKey}`,
            )
        }
      } else if (mission.missionType === "social") {
        if (mission.verificationKey.startsWith("twitter_")) {
          if (!user.twitterUsername) {
            throw new BadRequestException(
              "Please link your X/Twitter account first.",
            )
          }

          if (mission.verificationKey === "twitter_follow") {
            const isFollowing = await this.twitterVerifyService.checkFollow(
              user.twitterUsername,
              mission.actionUrl,
            )
            if (!isFollowing) {
              throw new BadRequestException(
                "You are not following the target account.",
              )
            }
          } else if (mission.verificationKey === "twitter_retweet") {
            const hasRetweeted = await this.twitterVerifyService.checkRetweet(
              user.twitterUsername,
              mission.actionUrl,
            )
            if (!hasRetweeted) {
              throw new BadRequestException(
                "You have not reposted the target post.",
              )
            }
          } else {
            throw new BadRequestException(
              `Unknown social verification key: ${mission.verificationKey}`,
            )
          }
        }
      }
    }

    // Update user's completed missions array and increment their arenaXp
    const updateQuery: any = {
      $push: { completedMissions: missionId },
    }

    if (mission.xpReward && mission.xpReward > 0) {
      updateQuery.$inc = { arenaXp: mission.xpReward }
    }

    if (mission.rewardMultiplier && mission.rewardMatchesCount) {
      updateQuery.$push.activeBoosts = {
        type: "match_based",
        multiplier: mission.rewardMultiplier,
        matchesRemaining: mission.rewardMatchesCount,
        source: "mission",
        sourceId: mission._id.toString(),
        category: null,
        expiresAt: null,
      }
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      updateQuery,
      { new: true },
    )

    this.logger.log(
      `User ${user.username} (${userId}) completed mission ${mission.title} (${missionId}) and earned ${mission.xpReward ?? 0} XP. Total XP is now ${updatedUser?.arenaXp}.`,
    )

    return {
      xpEarned: mission.xpReward ?? 0,
      totalXp: updatedUser?.arenaXp ?? 0,
      completedMissions: updatedUser?.completedMissions ?? [],
    }
  }

  // --- Admin Methods ---

  async createMission(dto: CreateMissionDto) {
    const hasXpReward =
      dto.xpReward !== undefined && dto.xpReward !== null && dto.xpReward > 0
    const hasMultiplierReward =
      (dto.rewardMultiplier !== undefined && dto.rewardMultiplier !== null) ||
      (dto.rewardMatchesCount !== undefined && dto.rewardMatchesCount !== null)

    if (hasXpReward && hasMultiplierReward) {
      throw new BadRequestException(
        "A mission cannot have both an XP reward and a Multiplier boost reward.",
      )
    }
    if (!hasXpReward && !hasMultiplierReward) {
      throw new BadRequestException(
        "A mission must have either an XP reward (> 0) or a Multiplier boost reward.",
      )
    }
    if (
      hasMultiplierReward &&
      (dto.rewardMultiplier === null ||
        dto.rewardMatchesCount === null ||
        dto.rewardMultiplier === undefined ||
        dto.rewardMatchesCount === undefined)
    ) {
      throw new BadRequestException(
        "Both rewardMultiplier and rewardMatchesCount must be set if using boost rewards.",
      )
    }

    const mission = new this.missionModel({
      title: dto.title,
      xpReward: hasXpReward ? dto.xpReward : null,
      actionUrl: dto.actionUrl,
      missionType: dto.missionType ?? "social",
      verificationKey: dto.verificationKey ?? null,
      rewardMultiplier: hasMultiplierReward ? dto.rewardMultiplier : null,
      rewardMatchesCount: hasMultiplierReward ? dto.rewardMatchesCount : null,
      isActive: true,
    })
    const saved = await mission.save()
    this.logger.log(
      `Admin created new mission: ${saved.title} (ID: ${saved._id})`,
    )
    return saved
  }

  async updateMission(id: string, dto: UpdateMissionDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid mission ID format.")
    }

    const existing = await this.missionModel.findById(id)
    if (!existing) throw new NotFoundException("Mission not found.")

    const merged = {
      xpReward: dto.xpReward !== undefined ? dto.xpReward : existing.xpReward,
      rewardMultiplier:
        dto.rewardMultiplier !== undefined
          ? dto.rewardMultiplier
          : existing.rewardMultiplier,
      rewardMatchesCount:
        dto.rewardMatchesCount !== undefined
          ? dto.rewardMatchesCount
          : existing.rewardMatchesCount,
    }

    const hasXpReward =
      merged.xpReward !== null &&
      merged.xpReward !== undefined &&
      merged.xpReward > 0
    const hasMultiplierReward =
      merged.rewardMultiplier !== null || merged.rewardMatchesCount !== null

    if (hasXpReward && hasMultiplierReward) {
      throw new BadRequestException(
        "A mission cannot have both an XP reward and a Multiplier boost reward.",
      )
    }
    if (!hasXpReward && !hasMultiplierReward) {
      throw new BadRequestException(
        "A mission must have either an XP reward (> 0) or a Multiplier boost reward.",
      )
    }
    if (
      hasMultiplierReward &&
      (merged.rewardMultiplier === null || merged.rewardMatchesCount === null)
    ) {
      throw new BadRequestException(
        "Both rewardMultiplier and rewardMatchesCount must be set if using boost rewards.",
      )
    }

    const updateSet: any = { ...dto }
    if (hasMultiplierReward) {
      updateSet.xpReward = null
    } else {
      updateSet.rewardMultiplier = null
      updateSet.rewardMatchesCount = null
    }

    const updated = await this.missionModel.findByIdAndUpdate(
      id,
      { $set: updateSet },
      { new: true },
    )

    this.logger.log(`Admin updated mission ID: ${id}`)
    return updated
  }

  async deleteMission(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid mission ID format.")
    }

    const deleted = await this.missionModel.findByIdAndDelete(id)
    if (!deleted) throw new NotFoundException("Mission not found.")
    this.logger.log(`Admin deleted mission ID: ${id}`)
    return { success: true }
  }
}
