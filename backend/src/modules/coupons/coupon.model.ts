import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type CouponDocument = HydratedDocument<Coupon>

@Schema({ timestamps: true, versionKey: false })
export class Coupon {
  @Prop({
    required: true,
    type: String,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  code: string

  @Prop({ required: true, type: Number, min: 1.0 })
  multiplier: number

  @Prop({ type: Boolean, default: true })
  isActive: boolean

  @Prop({ type: Number, default: 1 })
  maxUsesPerUser: number

  @Prop({ type: Number, default: null })
  maxTotalUses: number | null

  @Prop({ type: Number, default: 0 })
  currentTotalUses: number

  @Prop({ type: Date, default: null })
  expiresAt: Date | null

  createdAt?: Date
  updatedAt?: Date
}

export const CouponSchema = SchemaFactory.createForClass(Coupon)
