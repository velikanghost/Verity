import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import {
  FeedQueryDto,
  CreatePostDto,
  CreateMarketPostDto,
  CreatePostUnifiedDto,
  AddCommentDto,
  ToggleLikeDto,
  ToggleReshareDto,
  ValidateMarketPostDto,
} from './posts.dto';
import { CommentsService } from '../comments/comments.service';
import { InteractionsService } from '../interactions/interactions.service';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('posts')
@Controller(['posts', 'feed'])
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly interactionsService: InteractionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Fetch feed posts (normal posts and market posts)' })
  @ApiResponse({
    status: 200,
    description: 'Feed posts retrieved successfully.',
  })
  async fetchFeed(@Query() query: FeedQueryDto) {
    return this.postsService.fetchFeed(
      query.viewerProfileId || query.userId,
      query.onlyMarkets,
      query.profileId,
      query.tab,
    );
  }

  @Get(':postId')
  @ApiOperation({ summary: 'Fetch a single post by ID' })
  @ApiParam({
    name: 'postId',
    description: 'Post ID',
    example: '60d0fe4f5311236168a109ca',
  })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully.' })
  async fetchPostById(
    @Param('postId') postId: string,
    @Query('viewerProfileId') viewerProfileId?: string,
  ) {
    return this.postsService.findPostById(postId, viewerProfileId);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate market post details before on-chain payment' })
  @ApiBody({ type: ValidateMarketPostDto })
  @ApiResponse({
    status: 200,
    description: 'Market post details are valid.',
  })
  async validateMarket(@Body() dto: ValidateMarketPostDto) {
    this.postsService.validateMarketHeuristics(dto as any);
    return { success: true };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new post (normal or market)' })
  @ApiBody({ type: CreatePostUnifiedDto })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully.',
  })
  async createPost(@Body() dto: CreatePostUnifiedDto, @Request() req: any) {
    const authorId = req.user.id;
    if (dto.type === 'market') {
      return this.postsService.createMarketPost(authorId, dto as CreateMarketPostDto);
    }
    return this.postsService.createNormalPost(authorId, dto.content);
  }

  @Post(':postId/comment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a feed post' })
  @ApiParam({
    name: 'postId',
    description: 'Post ID comment is being added to',
    example: '60d0fe4f5311236168a109ca',
  })
  @ApiBody({ type: AddCommentDto })
  @ApiResponse({ status: 201, description: 'Comment added successfully.' })
  async addPostComment(
    @Param('postId') postId: string,
    @Body() dto: AddCommentDto,
    @Request() req: any,
  ) {
    const authorId = req.user.id;
    await this.commentsService.addComment(
      postId,
      authorId,
      dto.content,
      dto.parentId,
    );
    return null;
  }

  @Post(':postId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle like interaction on a feed post' })
  @ApiParam({
    name: 'postId',
    description: 'Post ID',
    example: '60d0fe4f5311236168a109ca',
  })
  @ApiBody({ type: ToggleLikeDto })
  @ApiResponse({
    status: 200,
    description: 'Like status toggled successfully.',
  })
  async likePost(
    @Param('postId') postId: string,
    @Body() dto: ToggleLikeDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    await this.interactionsService.toggleLike(
      postId,
      userId,
      Boolean(dto.currentlyActive),
    );
    return null;
  }

  @Post(':postId/reshare')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle reshare interaction on a feed post' })
  @ApiParam({
    name: 'postId',
    description: 'Post ID',
    example: '60d0fe4f5311236168a109ca',
  })
  @ApiBody({ type: ToggleReshareDto })
  @ApiResponse({
    status: 200,
    description: 'Reshare status toggled successfully.',
  })
  async resharePost(
    @Param('postId') postId: string,
    @Body() dto: ToggleReshareDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    await this.interactionsService.toggleReshare(
      postId,
      userId,
      Boolean(dto.currentlyActive),
    );
    return null;
  }
}
