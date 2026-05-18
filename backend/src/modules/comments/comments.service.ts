import { Injectable, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Comment, CommentDocument } from "./comments.model";
import { User, UserDocument } from "../users/users.model";
import { Post, PostDocument } from "../posts/posts.model";
import { serializeUser } from "../auth/auth.service";
import { PostsService } from "../posts/posts.service";
import { UserResponse } from "../auth/auth.service";

export interface CommentResponse {
  id: string;
  post_id: string;
  postId: string;
  author_id: string;
  authorId: string;
  content: string;
  likesCount: number;
  created_at: string;
  createdAt: string;
  updatedAt: string;
  author: UserResponse;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @Inject(forwardRef(() => PostsService))
    private readonly postsService: PostsService,
  ) {}

  private fallbackProfile(authorId: string): UserResponse {
    return {
      id: authorId,
      wallet_address: null,
      walletAddress: null,
      username: "unknown",
      display_name: "Unknown",
      displayName: "Unknown",
      avatar_url: null,
      avatarUrl: null,
      bio: null,
      followersCount: 0,
      followingCount: 0,
      signalPoints: 0,
      freeVotesCorrect: 0,
      freeVotesWrong: 0,
      freeVotesTotal: 0,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private serializeComment(comment: CommentDocument, author?: UserDocument | null): CommentResponse {
    const authorId = comment.authorId.toString();
    const createdAt = comment.createdAt ? new Date(comment.createdAt).toISOString() : new Date().toISOString();
    const updatedAt = comment.updatedAt ? new Date(comment.updatedAt).toISOString() : new Date().toISOString();

    return {
      id: comment.id || (comment as any)._id?.toString(),
      post_id: comment.postId.toString(),
      postId: comment.postId.toString(),
      author_id: authorId,
      authorId,
      content: comment.content,
      likesCount: comment.likesCount,
      created_at: createdAt,
      createdAt,
      updatedAt,
      author: author ? serializeUser(author) : this.fallbackProfile(authorId),
    };
  }

  async fetchPostComments(postId: string): Promise<CommentResponse[]> {
    const comments = await this.commentModel.find({ postId }).sort({ createdAt: -1 }).limit(50);
    const authors = await this.userModel.find({ _id: { $in: comments.map((comment) => comment.authorId) } });
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    return comments.map((comment) => this.serializeComment(comment, authorMap.get(comment.authorId.toString())));
  }

  async addComment(postId: string, profileId: string, content: string): Promise<void> {
    const [postExists, authorExists] = await Promise.all([
      this.postModel.exists({ _id: postId }),
      this.userModel.exists({ _id: profileId }),
    ]);

    if (!postExists) {
      throw new NotFoundException("Post not found.");
    }
    if (!authorExists) {
      throw new NotFoundException("Profile not found.");
    }

    await this.commentModel.create({
      postId: new Types.ObjectId(postId),
      authorId: new Types.ObjectId(profileId),
      content: content.trim(),
    });

    await this.postsService.incrementCommentsCount(postId);
  }
}
