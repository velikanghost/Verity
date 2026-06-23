import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type CategoryDocument = HydratedDocument<Category>

@Schema({ timestamps: true, versionKey: false })
export class Category {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug: string

  @Prop({ required: true, trim: true })
  displayName: string

  @Prop({ type: String, default: null })
  iconName: string | null

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean
}

export const CategorySchema = SchemaFactory.createForClass(Category)
