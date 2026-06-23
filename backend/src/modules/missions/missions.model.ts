import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type MissionDocument = HydratedDocument<Mission>

@Schema({ timestamps: true, versionKey: false })
export class Mission {
  @Prop({ type: String, required: true, trim: true })
  title: string


  @Prop({ type: Number, required: true, min: 0 })
  xpReward: number

  @Prop({ type: String, required: true, trim: true })
  actionUrl: string

  @Prop({ type: String, enum: ["social", "activity"], default: "social", index: true })
  missionType: "social" | "activity"

  @Prop({ type: String, default: null, index: true })
  verificationKey: string | null

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean

  createdAt?: Date
  updatedAt?: Date
}

export const MissionSchema = SchemaFactory.createForClass(Mission)
