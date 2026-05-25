import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Like, Reshare, LikeDocument, ReshareDocument } from "./interactions.model";
import { Post, PostDocument } from "../posts/posts.model";
import { User, UserDocument } from "../users/users.model";
import { SocketGateway } from "../socket/socket.gateway";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class InteractionsService {
  constructor(
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Reshare.name) private reshareModel: Model<ReshareDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async assertTargets(postId: string, profileId: string): Promise<void> {
    const [postExists, profileExists] = await Promise.all([
      this.postModel.exists({ _id: postId }),
      this.userModel.exists({ _id: profileId }),
    ]);

    if (!postExists) {
      throw new NotFoundException("Post not found.");
    }
    if (!profileExists) {
      throw new NotFoundException("Profile not found.");
    }
  }

  async toggleLike(postId: string, profileId: string, currentlyActive: boolean): Promise<void> {
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException("Post not found.");
    }
    if (post.type === "market") {
      throw new ConflictException("Market posts use upvotes/downvotes, not likes.");
    }

    const profileExists = await this.userModel.exists({ _id: profileId });
    if (!profileExists) {
      throw new NotFoundException("Profile not found.");
    }

    if (currentlyActive) {
      const deleted = await this.likeModel.deleteOne({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(profileId),
      });
      if (deleted.deletedCount > 0) {
        await this.postModel.updateOne({ _id: postId }, { $inc: { likesCount: -1 } });
      }
    } else {
      const result = await this.likeModel.updateOne(
        { postId: new Types.ObjectId(postId), userId: new Types.ObjectId(profileId) },
        { $setOnInsert: { postId: new Types.ObjectId(postId), userId: new Types.ObjectId(profileId) } },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        await this.postModel.updateOne({ _id: postId }, { $inc: { likesCount: 1 } });

        // Trigger notification
        const liker = await this.userModel.findById(profileId);
        const likerName = liker?.displayName || liker?.username || "Someone";
        const recipientId = post.authorId.toString();
        const actorId = profileId;
        if (recipientId !== actorId) {
          const snippet = post.content ? post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "") : "your post";
          await this.notificationsService.createNotification(
            recipientId,
            actorId,
            "like",
            "New like",
            `${likerName} liked your post: "${snippet}"`,
          );
        }
      }
    }

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`post:${postId}`, "post-updated", {});
  }

  async toggleReshare(postId: string, profileId: string, currentlyActive: boolean): Promise<void> {
    await this.assertTargets(postId, profileId);

    if (currentlyActive) {
      const deleted = await this.reshareModel.deleteOne({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(profileId),
      });
      if (deleted.deletedCount > 0) {
        await this.postModel.updateOne({ _id: postId }, { $inc: { resharesCount: -1 } });
      }
    } else {
      const result = await this.reshareModel.updateOne(
        { postId: new Types.ObjectId(postId), userId: new Types.ObjectId(profileId) },
        { $setOnInsert: { postId: new Types.ObjectId(postId), userId: new Types.ObjectId(profileId) } },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        await this.postModel.updateOne({ _id: postId }, { $inc: { resharesCount: 1 } });

        // Trigger notification
        const post = await this.postModel.findById(postId);
        const resharer = await this.userModel.findById(profileId);
        const resharerName = resharer?.displayName || resharer?.username || "Someone";
        const recipientId = post?.authorId?.toString();
        const actorId = profileId;
        if (post && recipientId && recipientId !== actorId) {
          const snippet = post.content ? post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "") : "your post";
          await this.notificationsService.createNotification(
            recipientId,
            actorId,
            "reshare",
            "New reshare",
            `${resharerName} reshared your post: "${snippet}"`,
          );
        }
      }
    }

    // Emit Socket events
    this.socketGateway.broadcastToRoom("feed", "feed-updated", {});
    this.socketGateway.broadcastToRoom(`post:${postId}`, "post-updated", {});
  }
}
