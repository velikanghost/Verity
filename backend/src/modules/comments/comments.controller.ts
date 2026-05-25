import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { CreateCommentDto, FetchCommentsQueryDto } from "./comments.dto";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("comments")
@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: "Get comments for a specific post" })
  @ApiResponse({ status: 200, description: "Comments retrieved successfully." })
  async fetchPostComments(@Query() query: FetchCommentsQueryDto) {
    return this.commentsService.fetchPostComments(query.postId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a comment to a post" })
  @ApiResponse({ status: 201, description: "Comment added successfully." })
  async addComment(@Body() createCommentDto: CreateCommentDto) {
    await this.commentsService.addComment(
      createCommentDto.postId,
      createCommentDto.profileId,
      createCommentDto.content,
      createCommentDto.parentId,
    );
    return null;
  }
}
