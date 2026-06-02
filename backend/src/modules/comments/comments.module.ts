import { Module, forwardRef } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { Comment, CommentSchema } from "./comments.model"
import { User, UserSchema } from "../users/users.model"
import { Post, PostSchema } from "../posts/posts.model"
import { CommentsService } from "./comments.service"
import { CommentsController } from "./comments.controller"
import { PostsModule } from "../posts/posts.module"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: User.name, schema: UserSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    forwardRef(() => PostsModule),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
