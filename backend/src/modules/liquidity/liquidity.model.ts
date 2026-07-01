import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

export type LiquidityPoolDocument = HydratedDocument<LiquidityPool>
export type LPPositionDocument = HydratedDocument<LPPosition>
export type LiquidityEventDocument = HydratedDocument<LiquidityEvent>
export type LpFeeLedgerDocument = HydratedDocument<LpFeeLedger>

@Schema({ timestamps: true, versionKey: false })
export class LiquidityPool {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Market",
    required: true,
    unique: true,
    index: true,
  })
  marketId: Types.ObjectId

  @Prop({ type: Number, default: 0 })
  yesBalance: number

  @Prop({ type: Number, default: 0 })
  noBalance: number

  @Prop({ type: Number, default: 0 })
  totalLPShares: number

  @Prop({ type: Number, default: 10 })
  creatorLiquidity: number

  @Prop({ type: String, required: true, trim: true })
  creatorAddress: string

  @Prop({ type: Number, default: 0 })
  collectedFeesLP: number

  @Prop({ type: Number, default: 0 })
  collectedFeesTreasury: number

  @Prop({ type: Number, default: 0 })
  currentPoolBalance: number

  @Prop({ type: Number, default: 20 })
  minimumPoolBalance: number

  @Prop({ type: Date, required: true })
  fundingDeadline: Date

  @Prop({
    type: String,
    enum: ["funding", "active", "resolved", "voided"],
    default: "funding",
    index: true,
  })
  status: "funding" | "active" | "resolved" | "voided"
}

export const LiquidityPoolSchema = SchemaFactory.createForClass(LiquidityPool)

@Schema({ timestamps: true, versionKey: false })
export class LPPosition {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "LiquidityPool",
    required: true,
    index: true,
  })
  poolId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop({ type: String, required: true, trim: true, index: true })
  walletAddress: string

  @Prop({ type: Number, default: 0 })
  lpShares: number

  @Prop({ type: Number, default: 0 })
  depositedUsdc: number

  @Prop({ type: Date, default: Date.now })
  depositedAt: Date

  @Prop({ type: Boolean, default: false })
  isCreator: boolean

  @Prop({ type: String, required: true, trim: true })
  depositTxHash: string
}

export const LPPositionSchema = SchemaFactory.createForClass(LPPosition)
// Compound index to guarantee uniqueness of user positions per pool
LPPositionSchema.index({ poolId: 1, userId: 1 }, { unique: true })

@Schema({ timestamps: true, versionKey: false })
export class LiquidityEvent {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "LiquidityPool",
    required: true,
    index: true,
  })
  poolId: Types.ObjectId

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: Types.ObjectId

  @Prop({
    type: String,
    enum: [
      "creator_deposit",
      "lp_deposit",
      "lp_withdraw",
      "fee_earned",
      "refund",
    ],
    required: true,
  })
  type:
    | "creator_deposit"
    | "lp_deposit"
    | "lp_withdraw"
    | "fee_earned"
    | "refund"

  @Prop({ type: Number, required: true })
  amount: number

  @Prop({ type: String, required: true, trim: true })
  txHash: string

  @Prop({ type: Number, required: true })
  lpSharesDelta: number
}

export const LiquidityEventSchema = SchemaFactory.createForClass(LiquidityEvent)

@Schema({ timestamps: true, versionKey: false })
export class LpFeeLedger {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, index: true })
  walletAddress: string

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null, index: true })
  userId: Types.ObjectId | null

  @Prop({ type: Number, default: 0 })
  accruedFeesUsdc: number

  @Prop({ type: Number, default: 0 })
  totalPaidFeesUsdc: number

  @Prop({ type: String, default: null })
  lastPayoutTxHash: string | null
}

export const LpFeeLedgerSchema = SchemaFactory.createForClass(LpFeeLedger)
