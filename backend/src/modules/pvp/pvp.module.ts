import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import {
  PvpTicket,
  PvpTicketSchema,
  PvpMatch,
  PvpMatchSchema,
} from "./pvp.model"
import {
  Market,
  MarketSchema,
  MarketPosition,
  MarketPositionSchema,
  MarketTrade,
  MarketTradeSchema,
} from "../markets/markets.model"
import { Post, PostSchema } from "../posts/posts.model"
import { User, UserSchema } from "../users/users.model"
import { PvpService } from "./pvp.service"
import { PvpController } from "./pvp.controller"
import { SocketModule } from "../socket/socket.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { LiquidityModule } from "../liquidity/liquidity.module"
import { AgentModule } from "../agent/agent.module"
import { CouponsModule } from "../coupons/coupons.module"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PvpTicket.name, schema: PvpTicketSchema },
      { name: PvpMatch.name, schema: PvpMatchSchema },
      { name: Market.name, schema: MarketSchema },
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
      { name: MarketPosition.name, schema: MarketPositionSchema },
      { name: MarketTrade.name, schema: MarketTradeSchema },
    ]),
    SocketModule,
    NotificationsModule,
    LiquidityModule,
    AgentModule,
    CouponsModule,
  ],
  controllers: [PvpController],
  providers: [PvpService],
  exports: [PvpService],
})
export class PvpModule {}
