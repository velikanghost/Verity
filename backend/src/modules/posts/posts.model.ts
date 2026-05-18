import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type PostType = "normal" | "market";
export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true, versionKey: false })
export class Post {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  authorId: Types.ObjectId;

  @Prop({ type: String, enum: ["normal", "market"], required: true })
  type: PostType;

  @Prop({ type: String, required: true, trim: true })
  content: string;

  @Prop({ type: Number, default: 0 })
  likesCount: number;

  @Prop({ type: Number, default: 0 })
  commentsCount: number;

  @Prop({ type: Number, default: 0 })
  resharesCount: number;

  @Prop({ type: Number, default: 0 })
  sharesCount: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.index({ createdAt: -1 });
