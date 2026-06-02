import { Module, forwardRef } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { Post, PostSchema } from "./posts.model"
import { User, UserSchema } from "../users/users.model"
import {
  Market,
  MarketSchema,
  Vote,
  VoteSchema,
} from "../markets/markets.model"
import {
  Like,
  LikeSchema,
  Reshare,
  ReshareSchema,
} from "../interactions/interactions.model"
import { Comment, CommentSchema } from "../comments/comments.model"
import { PostsService } from "./posts.service"
import { PostsController } from "./posts.controller"
import { CommentsModule } from "../comments/comments.module"
import { InteractionsModule } from "../interactions/interactions.module"
import { LiquidityModule } from "../liquidity/liquidity.module"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: Market.name, schema: MarketSchema },
      { name: Like.name, schema: LikeSchema },
      { name: Reshare.name, schema: ReshareSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    forwardRef(() => CommentsModule),
    InteractionsModule,
    LiquidityModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
