import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type LikeDocument = HydratedDocument<Like>;
export type ReshareDocument = HydratedDocument<Reshare>;

const interactionFields = {
  postId: { type: MongooseSchema.Types.ObjectId, ref: "Post", required: true, index: true },
  userId: { type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true },
  createdAt: { type: Date, default: Date.now },
};

@Schema({ versionKey: false })
export class Like {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Post", required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema({ versionKey: false })
export class Reshare {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Post", required: true, index: true })
  postId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
export const ReshareSchema = SchemaFactory.createForClass(Reshare);

LikeSchema.index({ postId: 1, userId: 1 }, { unique: true });
ReshareSchema.index({ postId: 1, userId: 1 }, { unique: true });
