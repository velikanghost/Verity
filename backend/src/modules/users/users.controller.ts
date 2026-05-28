import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  Inject,
  forwardRef,
  Request,
  ForbiddenException,
  Post as HttpPost,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.dto';
import { MarketsService } from '../markets/markets.service';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Types } from 'mongoose';
import { serializeUser } from '../auth/auth.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => MarketsService))
    private readonly marketsService: MarketsService,
  ) {}

  @Get('wallet/:walletAddress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get or create user by their on-chain wallet address',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Ethereum/Arc address',
    example: '0x28738040d191ff30673f546FB6BF997E6cdA6dbF',
  })
  @ApiResponse({
    status: 200,
    description: 'User fetched or created successfully.',
  })
  async getOrCreateWalletUser(@Param('walletAddress') walletAddress: string) {
    return this.usersService.getOrCreateByWallet(walletAddress);
  }

  @Get(':id/daily-votes')
  @ApiOperation({ summary: 'Get daily vote limits and usage for a user' })
  @ApiParam({
    name: 'id',
    description: 'User profile ID',
    example: '60d0fe4f5311236168a109ca',
  })
  @ApiResponse({ status: 200, description: 'Daily votes status retrieved.' })
  async getUserDailyVotes(@Param('id') id: string) {
    return this.marketsService.getDailyVotes(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile details' })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '60d0fe4f5311236168a109ca',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    if (req.user.id !== id) {
      throw new ForbiddenException('You can only update your own profile.');
    }
    return this.usersService.updateUser(id, updateUserDto);
  }

  @HttpPost(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  @ApiParam({
    name: 'id',
    description: 'Target user ID to follow',
    example: '60d0fe4f5311236168a109ca',
  })
  async followUser(@Param('id') id: string, @Request() req: any) {
    return this.usersService.follow(req.user.id, id);
  }

  @HttpPost(':id/unfollow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiParam({
    name: 'id',
    description: 'Target user ID to unfollow',
    example: '60d0fe4f5311236168a109ca',
  })
  async unfollowUser(@Param('id') id: string, @Request() req: any) {
    return this.usersService.unfollow(req.user.id, id);
  }

  @Get(':id/is-following')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user is following target user' })
  @ApiParam({
    name: 'id',
    description: 'Target user ID to check',
    example: '60d0fe4f5311236168a109ca',
  })
  async checkFollowing(@Param('id') id: string, @Request() req: any) {
    const following = await this.usersService.isFollowing(req.user.id, id);
    return { following };
  }

  @Get(':idOrUsername')
  @ApiOperation({ summary: 'Get user profile by ID or username' })
  @ApiParam({ name: 'idOrUsername', description: 'User ID or username' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully.',
  })
  async getUserProfile(@Param('idOrUsername') idOrUsername: string) {
    let user;
    if (Types.ObjectId.isValid(idOrUsername)) {
      try {
        user = await this.usersService.findUserById(idOrUsername);
      } catch (err) {
        user = await this.usersService.findUserByUsername(idOrUsername);
      }
    } else {
      user = await this.usersService.findUserByUsername(idOrUsername);
    }
    return serializeUser(user);
  }
}
