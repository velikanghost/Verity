import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, versionKey: false })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  recipientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  actorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  type: string; // e.g. "reply" | "like" | "reshare" | "settlement"

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({ type: Boolean, default: false, index: true })
  read: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
