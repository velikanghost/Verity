import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

export type VoteSide = string
export type VoteType = "free" | "usdc"
export type MarketTradeAction = "BUY" | "SELL"
export type MarketStatus =
  | "draft"
  | "open_for_votes"
  | "qualified"
  | "funding_pool"
  | "tradable"
  | "closed"
  | "resolving"
  | "resolved"
  | "voided"

export type MarketDocument = HydratedDocument<Market>
export type VoteDocument = HydratedDocument<Vote>
export type DailyVoteUsageDocument = HydratedDocument<DailyVoteUsage>
export type MarketPositionDocument = HydratedDocument<MarketPosition>
export type MarketTradeDocument = HydratedDocument<MarketTrade>

@Schema({ timestamps: true, versionKey: false })
export class Market {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Post",
    required: true,
    index: true,
  })
  postId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  authorId: Types.ObjectId

  @Prop({ type: String, required: true, trim: true })
  question: string

  @Prop({ type: String, required: true, trim: true, index: true })
  category: string

  @Prop({ type: Date, required: true, index: true })
  deadline: Date

  @Prop({ type: String, required: true, trim: true })
  resolutionSource: string

  @Prop({ type: String, required: true, trim: true })
  yesCondition: string

  @Prop({ type: String, required: true, trim: true })
  noCondition: string

  @Prop({
    type: String,
    enum: [
      "draft",
      "open_for_votes",
      "qualified",
      "funding_pool",
      "tradable",
      "closed",
      "resolving",
      "resolved",
      "voided",
    ],
    default: "qualified",
    index: true,
  })
  status: MarketStatus

  @Prop({ type: Number, default: 0 })
  freeYesVotes: number

  @Prop({ type: Number, default: 0 })
  freeNoVotes: number

  @Prop({ type: Number, default: 0 })
  totalFreeVotes: number

  @Prop({ type: Number, default: 0 })
  uniqueVotersCount: number

  @Prop({ type: Number, default: 50 })
  qualificationThreshold: number

  @Prop({ type: Number, default: 30 })
  uniqueVoterThreshold: number

  @Prop({ type: Number, default: 1 })
  marketCreationFeeUsdc: number

  @Prop({ type: String, default: null, trim: true })
  creationFeeTxHash: string | null

  @Prop({ type: String, default: null, trim: true })
  feeCollectorAddress: string | null

  @Prop({ type: Number, default: 0 })
  usdcYesAmount: number

  @Prop({ type: Number, default: 0 })
  usdcNoAmount: number

  @Prop({ type: Number, default: 0 })
  liquidity: number

  @Prop({ type: Number, default: 10 })
  creatorLiquidityUsdc: number

  @Prop({ type: Number, default: 40 })
  minimumPoolBalance: number

  @Prop({ type: Date, default: null })
  fundingDeadline: Date | null

  @Prop({ type: String, default: null })
  resolvedOutcome: string | null

  @Prop({ type: String, default: null, trim: true })
  resolvedByAdmin: string | null

  @Prop({ type: String, default: null, trim: true })
  priceFeedId: string | null

  @Prop({ type: Number, default: null })
  targetPrice: number | null

  @Prop({ type: Boolean, default: null })
  resolveAbove: boolean | null

  @Prop({ type: Boolean, default: false })
  isPythMarket: boolean

  @Prop({ type: Number, default: 2 })
  outcomeCount: number

  @Prop({ type: [String], default: [] })
  outcomes: string[]

  @Prop({ type: Number, default: null })
  handicap: number | null

  @Prop({ type: Number, default: null })
  winningOutcomeIndex: number | null

  @Prop({ type: [Number], default: [] })
  outcomeBalances: number[]

  @Prop({ type: [Number], default: [] })
  outcomePrices: number[]

  @Prop({
    type: String,
    enum: ["binary", "parent", "child"],
    default: "binary",
    index: true,
  })
  marketType: "binary" | "parent" | "child"

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Market",
    default: null,
    index: true,
  })
  parentMarketId: Types.ObjectId | null

  @Prop({ type: String, default: null, trim: true })
  optionName: string | null

  @Prop({ type: String, default: null, trim: true })
  teamName: string | null

  @Prop({ type: String, default: null, trim: true })
  optionGroup: string | null

  @Prop({ type: String, default: null })
  proposalReasoning: string | null

  @Prop({ type: [String], default: [] })
  proposalCitations: string[]

  @Prop({ type: String, default: null })
  proposalProposer: string | null

  @Prop({ type: String, default: null })
  proposalDisputer: string | null

  @Prop({ type: Boolean, default: false })
  disputed: boolean

  @Prop({ type: Boolean, default: null })
  proposedOutcome: boolean | null

  @Prop({ type: Number, default: null })
  proposedOutcomeIndex: number | null

  @Prop({ type: Date, default: null, index: true })
  proposedAt: Date | null

  @Prop({ type: Date, default: null, index: true })
  lockTime: Date | null

  createdAt?: Date
  updatedAt?: Date
}

export const MarketSchema = SchemaFactory.createForClass(Market)

MarketSchema.index(
  { creationFeeTxHash: 1 },
  { partialFilterExpression: { creationFeeTxHash: { $type: "string" } } },
)
MarketSchema.index({ category: 1, marketType: 1, status: 1, deadline: 1 })
MarketSchema.index({ parentMarketId: 1, marketType: 1 })

@Schema({ timestamps: true, versionKey: false })
export class Vote {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Market",
    required: true,
    index: true,
  })
  marketId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop({ type: String, enum: ["YES", "NO"], required: true })
  side: VoteSide

  @Prop({ type: String, enum: ["free", "usdc"], default: "free" })
  voteType: VoteType

  @Prop({ type: Number, default: 0 })
  amount: number
}

export const VoteSchema = SchemaFactory.createForClass(Vote)

VoteSchema.index({ marketId: 1, userId: 1, voteType: 1 }, { unique: true })

@Schema({ timestamps: true, versionKey: false })
export class DailyVoteUsage {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop({ type: String, required: true })
  date: string

  @Prop({ type: Number, default: 0, min: 0, max: 10 })
  votesUsed: number

  @Prop({ type: Number, default: 10 })
  votesLimit: number
}

export const DailyVoteUsageSchema = SchemaFactory.createForClass(DailyVoteUsage)

DailyVoteUsageSchema.index({ userId: 1, date: 1 }, { unique: true })

@Schema({ timestamps: true, versionKey: false })
export class MarketPosition {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Market",
    required: true,
    index: true,
  })
  marketId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop({ type: String, required: true })
  side: VoteSide

  @Prop({ type: Number, default: 0 })
  shares: number

  @Prop({ type: Number, default: 0 })
  avgPrice: number

  @Prop({ type: Number, default: 0 })
  investedUsdc: number

  @Prop({ type: Number, default: 0 })
  realizedPnl: number

  @Prop({ type: Boolean, default: false })
  isArchived: boolean

  createdAt?: Date
  updatedAt?: Date
}

export const MarketPositionSchema = SchemaFactory.createForClass(MarketPosition)

MarketPositionSchema.index(
  { marketId: 1, userId: 1, side: 1 },
  { unique: true },
)

@Schema({ versionKey: false })
export class MarketTrade {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Market",
    required: true,
    index: true,
  })
  marketId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop({ type: String, required: true })
  side: VoteSide

  @Prop({ type: String, enum: ["BUY", "SELL"], required: true })
  action: MarketTradeAction

  @Prop({ type: Number, default: 0 })
  shares: number

  @Prop({ type: Number, default: 0 })
  price: number

  @Prop({ type: Number, default: 0 })
  amountUsdc: number

  @Prop({ type: Number, default: 0 })
  feeUsdc: number

  @Prop({ type: Number, default: 0 })
  grossUsdc: number

  @Prop({ type: String, default: null })
  txHash: string | null

  @Prop({ type: Date, default: Date.now, index: true })
  createdAt: Date
}

export const MarketTradeSchema = SchemaFactory.createForClass(MarketTrade)
MarketTradeSchema.index({ marketId: 1, createdAt: -1 })
