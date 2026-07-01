import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

export type MissionDocument = HydratedDocument<Mission>

@Schema({ timestamps: true, versionKey: false })
export class Mission {
  @Prop({ type: String, required: true, trim: true })
  title: string

  @Prop({ type: Number, default: null, min: 0 })
  xpReward: number | null

  @Prop({ type: String, default: null, trim: true })
  actionUrl: string | null

  @Prop({
    type: String,
    enum: ["social", "activity"],
    default: "social",
    index: true,
  })
  missionType: "social" | "activity"

  @Prop({ type: String, default: null, index: true })
  verificationKey: string | null

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean

  @Prop({ type: Number, default: null })
  rewardMultiplier: number | null

  @Prop({ type: Number, default: null })
  rewardMatchesCount: number | null

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Market",
    default: null,
    index: true,
  })
  marketId: Types.ObjectId | null

  createdAt?: Date
  updatedAt?: Date
}

export const MissionSchema = SchemaFactory.createForClass(Mission)
