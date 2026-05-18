import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { CreateCommentDto, FetchCommentsQueryDto } from "./comments.dto";

@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  async fetchPostComments(@Query() query: FetchCommentsQueryDto) {
    return this.commentsService.fetchPostComments(query.postId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addComment(@Body() createCommentDto: CreateCommentDto) {
    await this.commentsService.addComment(createCommentDto.postId, createCommentDto.profileId, createCommentDto.content);
    return null;
  }
}
