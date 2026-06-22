import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { User, UserSchema } from "../users/users.model"
import { Mission, MissionSchema } from "./missions.model"
import { MissionsService } from "./missions.service"
import { MissionsController } from "./missions.controller"
import { TwitterVerifyService } from "./twitter-verify.service"
import { Vote, VoteSchema, MarketTrade, MarketTradeSchema } from "../markets/markets.model"
import { Comment, CommentSchema } from "../comments/comments.model"
import { Like, LikeSchema } from "../interactions/interactions.model"
import { LPPosition, LPPositionSchema } from "../liquidity/liquidity.model"
import { Post, PostSchema } from "../posts/posts.model"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Mission.name, schema: MissionSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: MarketTrade.name, schema: MarketTradeSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Like.name, schema: LikeSchema },
      { name: LPPosition.name, schema: LPPositionSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [MissionsController],
  providers: [MissionsService, TwitterVerifyService],
  exports: [MissionsService],
})
export class MissionsModule {}
