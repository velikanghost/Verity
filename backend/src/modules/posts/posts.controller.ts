import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { PostsService } from "./posts.service";
import { FeedQueryDto, CreatePostDto, CreateMarketPostDto } from "./posts.dto";
import { CommentsService } from "../comments/comments.service";
import { InteractionsService } from "../interactions/interactions.service";

@Controller(["posts", "feed"])
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  @Get()
  async fetchFeed(@Query() query: FeedQueryDto) {
    return this.postsService.fetchFeed(
      query.viewerProfileId || query.userId,
      query.onlyMarkets,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createNormalPostDirect(@Body() dto: CreatePostDto) {
    const authorId = dto.authorId || dto.profileId;
    return this.postsService.createNormalPost(authorId!, dto.content);
  }

  @Post("normal")
  @HttpCode(HttpStatus.CREATED)
  async createNormalPost(@Body() dto: CreatePostDto) {
    const authorId = dto.authorId || dto.profileId;
    return this.postsService.createNormalPost(authorId!, dto.content);
  }

  @Post("market")
  @HttpCode(HttpStatus.CREATED)
  async createMarketPost(@Body() dto: CreateMarketPostDto) {
    const authorId = dto.authorId || dto.profileId;
    return this.postsService.createMarketPost(authorId!, dto);
  }

  @Post(":postId/comment")
  @HttpCode(HttpStatus.CREATED)
  async addPostComment(
    @Param("postId") postId: string,
    @Body("authorId") authorId?: string,
    @Body("profileId") profileId?: string,
    @Body("content") content?: string,
  ) {
    const pId = authorId || profileId;
    await this.commentsService.addComment(postId, pId!, content!);
    return null;
  }

  @Post(":postId/like")
  @HttpCode(HttpStatus.OK)
  async likePost(
    @Param("postId") postId: string,
    @Body("userId") userId?: string,
    @Body("profileId") profileId?: string,
    @Body("currentlyActive") currentlyActive?: boolean,
  ) {
    const pId = userId || profileId;
    await this.interactionsService.toggleLike(postId, pId!, Boolean(currentlyActive));
    return null;
  }

  @Post(":postId/reshare")
  @HttpCode(HttpStatus.OK)
  async resharePost(
    @Param("postId") postId: string,
    @Body("userId") userId?: string,
    @Body("profileId") profileId?: string,
    @Body("currentlyActive") currentlyActive?: boolean,
  ) {
    const pId = userId || profileId;
    await this.interactionsService.toggleReshare(postId, pId!, Boolean(currentlyActive));
    return null;
  }
}
