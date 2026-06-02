import { Module, forwardRef } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import {
  Market,
  MarketSchema,
  Vote,
  VoteSchema,
  DailyVoteUsage,
  DailyVoteUsageSchema,
  MarketPosition,
  MarketPositionSchema,
  MarketTrade,
  MarketTradeSchema,
} from "./markets.model"
import { User, UserSchema } from "../users/users.model"
import { Post, PostSchema } from "../posts/posts.model"
import { MarketsService } from "./markets.service"
import { MarketsKeeperService } from "./marketskeeper.service"
import { MarketsController } from "./markets.controller"
import { PostsModule } from "../posts/posts.module"
import { AgentModule } from "../agent/agent.module"
import { PvpModule } from "../pvp/pvp.module"

@Module({
  imports: [
    AgentModule,
    MongooseModule.forFeature([
      { name: Market.name, schema: MarketSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: DailyVoteUsage.name, schema: DailyVoteUsageSchema },
      { name: MarketPosition.name, schema: MarketPositionSchema },
      { name: MarketTrade.name, schema: MarketTradeSchema },
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    forwardRef(() => PostsModule),
    PvpModule,
  ],
  controllers: [MarketsController],
  providers: [MarketsService, MarketsKeeperService],
  exports: [MarketsService, MarketsKeeperService],
})
export class MarketsModule {}
