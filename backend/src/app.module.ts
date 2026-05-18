import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { InteractionsModule } from "./modules/interactions/interactions.module";
import { PostsModule } from "./modules/posts/posts.module";
import { MarketsModule } from "./modules/markets/markets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>("MONGODB_URI", "mongodb://127.0.0.1:27017/verity"),
      }),
    }),
    AuthModule,
    UsersModule,
    CommentsModule,
    InteractionsModule,
    PostsModule,
    MarketsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

