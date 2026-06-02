import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { PvpTicket, PvpTicketSchema, PvpMatch, PvpMatchSchema } from "./pvp.model"
import { Market, MarketSchema } from "../markets/markets.model"
import { Post, PostSchema } from "../posts/posts.model"
import { User, UserSchema } from "../users/users.model"
import { PvpService } from "./pvp.service"
import { PvpController } from "./pvp.controller"
import { SocketModule } from "../socket/socket.module"
import { NotificationsModule } from "../notifications/notifications.module"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PvpTicket.name, schema: PvpTicketSchema },
      { name: PvpMatch.name, schema: PvpMatchSchema },
      { name: Market.name, schema: MarketSchema },
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SocketModule,
    NotificationsModule,
  ],
  controllers: [PvpController],
  providers: [PvpService],
  exports: [PvpService],
})
export class PvpModule {}
