import { Injectable, NotFoundException, Logger } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import { Notification, NotificationDocument } from "./notifications.model"
import { User, UserDocument } from "../users/users.model"
import { serializeUser } from "../auth/auth.service"
import { SocketGateway } from "../socket/socket.gateway"

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private socketGateway: SocketGateway,
  ) {}

  async createNotification(
    recipientId: string,
    actorId: string,
    type: string,
    title: string,
    body: string,
    targetId?: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.create({
      recipientId: new Types.ObjectId(recipientId),
      actorId: new Types.ObjectId(actorId),
      type,
      title,
      body,
      targetId: targetId || null,
      read: false,
    })

    // Populate actor info for socket payload
    const actor = await this.userModel.findById(actorId)
    const serializedActor = actor ? serializeUser(actor) : null

    // Send real-time notification update to client
    const socketPayload = {
      id: notification._id.toString(),
      recipientId,
      actorId,
      type,
      title,
      body,
      targetId: notification.targetId || null,
      read: false,
      createdAt:
        notification.createdAt?.toISOString() || new Date().toISOString(),
      actor: serializedActor,
    }

    // Broadcast user updates
    this.socketGateway.broadcastToRoom(
      `user:${recipientId}`,
      "notification-created",
      socketPayload,
    )

    this.logger.log(
      `Notification created for recipient ${recipientId} by actor ${actorId}. Type: ${type}, Title: "${title}"`,
    )

    return notification
  }

  async getUserNotifications(userId: string) {
    const notifications = await this.notificationModel
      .find({ recipientId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)

    const actorIds = notifications.map((n) => n.actorId)
    const actors = await this.userModel.find({ _id: { $in: actorIds } })
    const actorMap = new Map(
      actors.map((actor) => [actor.id, serializeUser(actor)]),
    )

    return notifications.map((n) => {
      const actorIdStr = n.actorId.toString()
      return {
        id: n._id.toString(),
        recipientId: n.recipientId.toString(),
        actorId: actorIdStr,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        targetId: n.targetId || null,
        createdAt: n.createdAt
          ? n.createdAt.toISOString()
          : new Date().toISOString(),
        actor: actorMap.get(actorIdStr) || {
          id: actorIdStr,
          username: "unknown",
          displayName: "Unknown",
          avatarUrl: null,
        },
      }
    })
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, recipientId: new Types.ObjectId(userId) },
      { read: true },
      { new: true },
    )

    if (!notification) {
      throw new NotFoundException("Notification not found.")
    }

    // Trigger user updates to refresh badge count
    this.socketGateway.broadcastToRoom(`user:${userId}`, "user-updated", {})

    this.logger.log(
      `Notification ${notificationId} marked as read by user ${userId}`,
    )

    return notification
  }

  async markAllAsRead(userId: string) {
    await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(userId), read: false },
      { read: true },
    )
    this.socketGateway.broadcastToRoom(`user:${userId}`, "user-updated", {})

    this.logger.log(`All notifications marked as read for user ${userId}`)
  }
}
