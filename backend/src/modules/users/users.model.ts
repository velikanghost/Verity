import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

export type UserDocument = HydratedDocument<User>
export type FollowDocument = HydratedDocument<Follow>

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, trim: true, lowercase: true, default: null })
  walletAddress: string | null

  @Prop({ type: String, trim: true, lowercase: true, default: null })
  email: string | null

  @Prop({ type: String, enum: ["user", "admin"], default: "user" })
  role: string

  @Prop({ type: String, default: null, trim: true, index: true })
  privyDid: string | null

  @Prop({ type: String, default: null, trim: true, index: true })
  circleWalletId: string | null

  @Prop({ type: String, required: true, unique: true, trim: true })
  username: string

  @Prop({ type: Boolean, default: false })
  isOnboarded: boolean

  @Prop({ type: String, default: null, trim: true })
  displayName: string | null

  @Prop({ type: String, default: null, trim: true })
  avatarUrl: string | null

  @Prop({ type: String, default: null, trim: true })
  bio: string | null

  @Prop({ type: Number, default: 0 })
  followersCount: number

  @Prop({ type: Number, default: 0 })
  followingCount: number

  @Prop({ type: Number, default: 0 })
  signalPoints: number

  @Prop({ type: Number, default: 0 })
  freeVotesCorrect: number

  @Prop({ type: Number, default: 0 })
  freeVotesWrong: number

  @Prop({ type: Number, default: 0 })
  freeVotesTotal: number

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  })
  referredById: Types.ObjectId | null

  @Prop({ type: Number, default: 0 })
  arenaXp: number

  @Prop({ type: Number, default: 0 })
  doubleBoostRemaining: number

  @Prop({ type: Number, default: 0 })
  downtimeBoostRemaining: number

  @Prop({ type: Boolean, default: false })
  hasWonFirstPvpDuel: boolean

  @Prop({ type: Boolean, default: false })
  hasUsedBronzeBoost: boolean

  @Prop({ type: Number, default: 0 })
  pvpTicketsSubmittedCount: number

  @Prop({ type: Number, default: 0 })
  pvpMatchesWonCount: number

  @Prop({ type: Number, default: 0 })
  pvpMatchesLostCount: number

  @Prop({ type: Number, default: 0 })
  pvpMatchesDrawnCount: number

  createdAt?: Date
  updatedAt?: Date
}

export const UserSchema = SchemaFactory.createForClass(User)

UserSchema.index(
  { walletAddress: 1 },
  {
    unique: true,
    partialFilterExpression: { walletAddress: { $type: "string" } },
  },
)
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
)
// Compound index for PvP leaderboard queries (sort by arenaXp descending, filter by isOnboarded)
UserSchema.index({ isOnboarded: 1, arenaXp: -1 })
// Compound index for referee list sorting by XP
UserSchema.index({ referredById: 1, arenaXp: -1 })

@Schema({ timestamps: true, versionKey: false })
export class Follow {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  followerId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  followingId: Types.ObjectId
}

export const FollowSchema = SchemaFactory.createForClass(Follow)
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true })

@Schema({ timestamps: true, versionKey: false })
export class OtpCode {
  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  email: string

  @Prop({ type: String, required: true, trim: true })
  code: string

  @Prop({ type: Date, required: true })
  expiresAt: Date
}

export type OtpCodeDocument = HydratedDocument<OtpCode>
export const OtpCodeSchema = SchemaFactory.createForClass(OtpCode)
// Ensure OtpCode document expires automatically when expiresAt passes
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
