import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import { User, UserDocument, Follow, FollowDocument } from "./users.model"
import { serializeUser } from "../auth/auth.service"
import { UpdateUserDto } from "./users.dto"

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Follow.name) private followModel: Model<FollowDocument>,
  ) {}

  private normalizeWallet(address: string): string {
    const clean = address.trim().toLowerCase()
    return clean.startsWith("0x") ? clean : `0x${clean}`
  }

  private defaultUsername(address: string): string {
    return `${address.slice(-4).toLowerCase()}_${Math.floor(Math.random() * 9000 + 1000)}`
  }

  async getOrCreateByWallet(walletAddress: string) {
    const wallet = this.normalizeWallet(walletAddress)
    const existing = await this.userModel.findOne({ walletAddress: wallet })
    if (existing) return serializeUser(existing)

    const created = await this.userModel.create({
      walletAddress: wallet,
      username: this.defaultUsername(wallet),
      displayName: `V_${wallet.slice(-4).toUpperCase()}`,
    })

    return serializeUser(created)
  }

  async updateUser(id: string, input: UpdateUserDto) {
    const user = await this.userModel.findById(id)
    if (!user) {
      throw new NotFoundException("User not found.")
    }

    user.username = input.username
    user.displayName = input.display_name || null
    user.avatarUrl = input.avatar_url || null
    user.bio = input.bio || null

    if (input.isOnboarded !== undefined) {
      user.isOnboarded = input.isOnboarded
    }

    if (input.referrerUsername && !user.referredById) {
      const referrer = await this.userModel.findOne({
        username: {
          $regex: new RegExp(`^${input.referrerUsername.trim()}$`, "i"),
        },
      })
      if (referrer && referrer._id.toString() !== id) {
        user.referredById = referrer._id
      }
    }

    const updated = await user.save()
    return serializeUser(updated)
  }

  async findUserById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id)
    if (!user) {
      throw new NotFoundException("User not found.")
    }
    return user
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException("You cannot follow yourself.")
    }
    const targetUser = await this.userModel.findById(followingId)
    if (!targetUser) {
      throw new NotFoundException("Target user not found.")
    }
    const existing = await this.followModel.findOne({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    })
    if (existing) {
      return { success: true, message: "Already following" }
    }

    await this.followModel.create({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    })

    await this.userModel.findByIdAndUpdate(followerId, {
      $inc: { followingCount: 1 },
    })
    await this.userModel.findByIdAndUpdate(followingId, {
      $inc: { followersCount: 1 },
    })

    return { success: true }
  }

  async unfollow(followerId: string, followingId: string) {
    const existing = await this.followModel.findOne({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    })
    if (!existing) {
      return { success: true, message: "Not following" }
    }

    await this.followModel.deleteOne({ _id: existing._id })

    await this.userModel.findByIdAndUpdate(followerId, {
      $inc: { followingCount: -1 },
    })
    await this.userModel.findByIdAndUpdate(followingId, {
      $inc: { followersCount: -1 },
    })

    return { success: true }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const existing = await this.followModel.exists({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    })
    return !!existing
  }

  async findUserByUsername(username: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    })
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found.`)
    }
    return user
  }
}
