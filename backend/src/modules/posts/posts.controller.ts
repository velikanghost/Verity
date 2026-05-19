import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { PostsService } from "./posts.service";
import { FeedQueryDto, CreatePostDto, CreateMarketPostDto } from "./posts.dto";
import { CommentsService } from "../comments/comments.service";
import { InteractionsService } from "../interactions/interactions.service";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse, ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsNotEmpty } from "class-validator";

class AddCommentDto {
  @ApiPropertyOptional({ description: "Author User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional({ description: "Alternative profile ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: "Comment body content", example: "This is a great market!" })
  @IsString()
  @IsNotEmpty()
  content: string;
}

class ToggleLikeDto {
  @ApiPropertyOptional({ description: "User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: "Alternative profile ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: "Set active like status", example: true })
  @IsBoolean()
  currentlyActive: boolean;
}

class ToggleReshareDto {
  @ApiPropertyOptional({ description: "User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: "Alternative profile ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: "Set active reshare status", example: true })
  @IsBoolean()
  currentlyActive: boolean;
}

@ApiTags("posts")
@Controller(["posts", "feed"])
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Fetch feed posts (normal posts and market posts)" })
  @ApiResponse({ status: 200, description: "Feed posts retrieved successfully." })
  async fetchFeed(@Query() query: FeedQueryDto) {
    return this.postsService.fetchFeed(
      query.viewerProfileId || query.userId,
      query.onlyMarkets,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new normal post (Direct endpoint)" })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: "Normal post created successfully." })
  async createNormalPostDirect(@Body() dto: CreatePostDto) {
    const authorId = dto.authorId || dto.profileId;
    return this.postsService.createNormalPost(authorId!, dto.content);
  }

  @Post("normal")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new normal post" })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: "Normal post created successfully." })
  async createNormalPost(@Body() dto: CreatePostDto) {
    const authorId = dto.authorId || dto.profileId;
    return this.postsService.createNormalPost(authorId!, dto.content);
  }

  @Post("market")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new prediction market post" })
  @ApiBody({ type: CreateMarketPostDto })
  @ApiResponse({ status: 201, description: "Market post created successfully." })
  async createMarketPost(@Body() dto: CreateMarketPostDto) {
    const authorId = dto.authorId || dto.profileId;
    return this.postsService.createMarketPost(authorId!, dto);
  }

  @Post(":postId/comment")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add a comment to a feed post" })
  @ApiParam({ name: "postId", description: "Post ID comment is being added to", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: AddCommentDto })
  @ApiResponse({ status: 201, description: "Comment added successfully." })
  async addPostComment(
    @Param("postId") postId: string,
    @Body() dto: AddCommentDto,
  ) {
    const pId = dto.authorId || dto.profileId;
    await this.commentsService.addComment(postId, pId!, dto.content);
    return null;
  }

  @Post(":postId/like")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle like interaction on a feed post" })
  @ApiParam({ name: "postId", description: "Post ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: ToggleLikeDto })
  @ApiResponse({ status: 200, description: "Like status toggled successfully." })
  async likePost(
    @Param("postId") postId: string,
    @Body() dto: ToggleLikeDto,
  ) {
    const pId = dto.userId || dto.profileId;
    await this.interactionsService.toggleLike(postId, pId!, Boolean(dto.currentlyActive));
    return null;
  }

  @Post(":postId/reshare")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle reshare interaction on a feed post" })
  @ApiParam({ name: "postId", description: "Post ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: ToggleReshareDto })
  @ApiResponse({ status: 200, description: "Reshare status toggled successfully." })
  async resharePost(
    @Param("postId") postId: string,
    @Body() dto: ToggleReshareDto,
  ) {
    const pId = dto.userId || dto.profileId;
    await this.interactionsService.toggleReshare(postId, pId!, Boolean(dto.currentlyActive));
    return null;
  }
}
