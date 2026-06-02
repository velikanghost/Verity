import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

export type CommentDocument = HydratedDocument<Comment>

@Schema({ timestamps: true, versionKey: false })
export class Comment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Post",
    required: true,
    index: true,
  })
  postId: Types.ObjectId

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  authorId: Types.ObjectId

  @Prop({ type: String, required: true, trim: true })
  content: string

  @Prop({ type: Number, default: 0 })
  likesCount: number

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Comment",
    required: false,
    index: true,
  })
  parentId?: Types.ObjectId

  createdAt?: Date
  updatedAt?: Date
}

export const CommentSchema = SchemaFactory.createForClass(Comment)
