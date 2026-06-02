import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { Like, LikeSchema, Reshare, ReshareSchema } from "./interactions.model"
import { Post, PostSchema } from "../posts/posts.model"
import { User, UserSchema } from "../users/users.model"
import { InteractionsService } from "./interactions.service"
import { InteractionsController } from "./interactions.controller"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Like.name, schema: LikeSchema },
      { name: Reshare.name, schema: ReshareSchema },
      { name: Post.name, schema: PostSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}
