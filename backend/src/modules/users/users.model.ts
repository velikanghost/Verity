import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, trim: true, lowercase: true, default: null })
  walletAddress: string | null;

  @Prop({ type: String, trim: true, lowercase: true, default: null })
  email: string | null;

  @Prop({ type: String, default: null })
  passwordHash: string | null;

  @Prop({ type: String, required: true, unique: true, trim: true })
  username: string;

  @Prop({ type: String, default: null, trim: true })
  displayName: string | null;

  @Prop({ type: String, default: null, trim: true })
  avatarUrl: string | null;

  @Prop({ type: String, default: null, trim: true })
  bio: string | null;

  @Prop({ type: Number, default: 0 })
  followersCount: number;

  @Prop({ type: Number, default: 0 })
  followingCount: number;

  @Prop({ type: Number, default: 0 })
  signalPoints: number;

  @Prop({ type: Number, default: 0 })
  freeVotesCorrect: number;

  @Prop({ type: Number, default: 0 })
  freeVotesWrong: number;

  @Prop({ type: Number, default: 0 })
  freeVotesTotal: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { walletAddress: 1 },
  { unique: true, partialFilterExpression: { walletAddress: { $type: "string" } } },
);
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
