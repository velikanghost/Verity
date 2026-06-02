import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { MongooseModule } from "@nestjs/mongoose"
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler"
import { APP_GUARD } from "@nestjs/core"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { AuthModule } from "./modules/auth/auth.module"
import { UsersModule } from "./modules/users/users.module"
import { CommentsModule } from "./modules/comments/comments.module"
import { InteractionsModule } from "./modules/interactions/interactions.module"
import { PostsModule } from "./modules/posts/posts.module"
import { MarketsModule } from "./modules/markets/markets.module"
import { BlockchainModule } from "./modules/blockchain/blockchain.module"
import { LiquidityModule } from "./modules/liquidity/liquidity.module"
import { SocketModule } from "./modules/socket/socket.module"
import { NotificationsModule } from "./modules/notifications/notifications.module"
import { CircleWalletModule } from "./modules/circle-wallet/circle-wallet.module"
import { PvpModule } from "./modules/pvp/pvp.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          "MONGODB_URI",
          "mongodb://127.0.0.1:27017/verity",
        ),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    AuthModule,
    UsersModule,
    CommentsModule,
    InteractionsModule,
    PostsModule,
    MarketsModule,
    BlockchainModule,
    LiquidityModule,
    SocketModule,
    NotificationsModule,
    CircleWalletModule,
    PvpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
