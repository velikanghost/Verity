import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

export type PvpTicketDocument = HydratedDocument<PvpTicket>
export type PvpMatchDocument = HydratedDocument<PvpMatch>

@Schema({ _id: false })
export class PvpPick {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Market", required: true })
  marketId: Types.ObjectId

  @Prop({ type: String, enum: ["YES", "NO"], required: true })
  selection: "YES" | "NO"

  @Prop({ type: Boolean, default: null })
  isCorrect: boolean | null
}

@Schema({ timestamps: true, versionKey: false })
export class PvpTicket {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  userId: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Market", required: true, index: true })
  parentMarketId: Types.ObjectId

  @Prop({ type: [PvpPick], required: true })
  picks: PvpPick[]

  @Prop({
    type: String,
    enum: ["queued", "matched", "resolved", "cancelled"],
    default: "queued",
    index: true,
  })
  status: "queued" | "matched" | "resolved" | "cancelled"

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "PvpMatch", default: null, index: true })
  matchId: Types.ObjectId | null

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "PvpTicket", default: null })
  opponentTicketId: Types.ObjectId | null

  @Prop({ type: Number, default: 0 })
  score: number

  @Prop({ type: Number, default: 0 })
  xpEarned: number

  @Prop({ type: Number, default: 0 })
  eloChange: number

  @Prop({ type: Boolean, default: false })
  doubleBoostActive: boolean

  createdAt?: Date
  updatedAt?: Date
}

export const PvpTicketSchema = SchemaFactory.createForClass(PvpTicket)
PvpTicketSchema.index({ userId: 1, parentMarketId: 1, status: 1 })

@Schema({ timestamps: true, versionKey: false })
export class PvpMatch {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Market", required: true, index: true })
  parentMarketId: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "PvpTicket", required: true })
  ticket1Id: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "PvpTicket", required: true })
  ticket2Id: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  user1Id: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  user2Id: Types.ObjectId

  @Prop({ type: Number, required: true })
  divergenceScore: number

  @Prop({
    type: String,
    enum: ["matched", "resolved"],
    default: "matched",
    index: true,
  })
  status: "matched" | "resolved"

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null })
  winnerId: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null

  createdAt?: Date
  updatedAt?: Date
}

export const PvpMatchSchema = SchemaFactory.createForClass(PvpMatch)
PvpMatchSchema.index({ user1Id: 1, status: 1 })
PvpMatchSchema.index({ user2Id: 1, status: 1 })
