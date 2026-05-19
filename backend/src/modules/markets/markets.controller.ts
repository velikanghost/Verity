import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { MarketsService } from "./markets.service";
import { FetchMarketsQueryDto, CastFreeVoteDto, ExecuteTradeDto } from "./markets.dto";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery, ApiResponse, ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsIn } from "class-validator";

class ResolveMarketDto {
  @ApiProperty({ description: "Winning outcome", enum: ["YES", "NO"], example: "YES" })
  @IsString()
  @IsIn(["YES", "NO"])
  winningOutcome: "YES" | "NO";

  @ApiProperty({ description: "Transaction hash of the resolution on-chain", example: "0x123abc..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;

  @ApiProperty({ description: "Admin address performing resolution", example: "0x28738040d191ff30673f546FB6BF997E6cdA6dbF" })
  @IsString()
  @IsNotEmpty()
  adminAddress: string;
}

@ApiTags("markets")
@Controller("markets")
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  @ApiOperation({ summary: "Fetch all prediction markets with filters" })
  @ApiResponse({ status: 200, description: "Markets fetched successfully." })
  async fetchMarkets(@Query() query: FetchMarketsQueryDto) {
    return this.marketsService.fetchMarkets({
      status: query.status as any,
      category: query.category,
      trending: query.trending,
      newest: query.newest,
      qualified: query.qualified,
      open_for_votes: query.open_for_votes,
    });
  }

  @Get(":marketId")
  @ApiOperation({ summary: "Get detailed information about a single prediction market" })
  @ApiParam({ name: "marketId", description: "Market ID (MongoDB ObjectId or unique string)", example: "60d0fe4f5311236168a109ca" })
  @ApiQuery({ name: "userId", required: false, description: "Optional user ID to get viewer vote status" })
  @ApiResponse({ status: 200, description: "Market detail fetched successfully." })
  async fetchMarketDetail(
    @Param("marketId") marketId: string,
    @Query("userId") userId?: string,
  ) {
    return this.marketsService.fetchMarketDetail(marketId, userId);
  }

  @Get(":marketId/positions")
  @ApiOperation({ summary: "Get trading positions in a market for a specific user" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiQuery({ name: "profileId", description: "User profile ID to fetch positions for" })
  @ApiResponse({ status: 200, description: "Positions retrieved successfully." })
  async fetchMarketPositions(
    @Param("marketId") marketId: string,
    @Query("profileId") profileId: string,
  ) {
    return this.marketsService.fetchMarketPositions(marketId, profileId);
  }

  @Get(":marketId/trades")
  @ApiOperation({ summary: "Get list of recent trades in a prediction market" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiResponse({ status: 200, description: "Recent trades retrieved successfully." })
  async fetchMarketTrades(@Param("marketId") marketId: string) {
    return this.marketsService.fetchMarketTrades(marketId);
  }

  @Post(":marketId/vote")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cast a free vote on a market (Alternative endpoint)" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: CastFreeVoteDto })
  @ApiResponse({ status: 200, description: "Free vote cast successfully." })
  async castFreeVoteDirect(
    @Param("marketId") marketId: string,
    @Body() dto: CastFreeVoteDto,
  ) {
    const authorId = dto.userId || dto.profileId;
    return this.marketsService.castFreeVote(marketId, authorId!, dto.side);
  }

  @Post(":marketId/free-vote")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cast a free vote on a market" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: CastFreeVoteDto })
  @ApiResponse({ status: 200, description: "Free vote cast successfully." })
  async castFreeVote(
    @Param("marketId") marketId: string,
    @Body() dto: CastFreeVoteDto,
  ) {
    const authorId = dto.userId || dto.profileId;
    return this.marketsService.castFreeVote(marketId, authorId!, dto.side);
  }

  @Post(":marketId/approve-trading")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Admin: Approve a qualified market, moving it to funding_pool status" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiResponse({ status: 200, description: "Market approved and transitioned to funding_pool." })
  async approveMarketForTrading(@Param("marketId") marketId: string) {
    return this.marketsService.approveMarketForTrading(marketId);
  }

  @Post(":marketId/trade")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Execute outcome token buy/sell trades on a market" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: ExecuteTradeDto })
  @ApiResponse({ status: 200, description: "Trade processed successfully." })
  async executeMarketTrade(
    @Param("marketId") marketId: string,
    @Body() dto: ExecuteTradeDto,
  ) {
    return this.marketsService.executeMarketTrade(marketId, dto);
  }

  @Post(":marketId/resolve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Admin: Resolve a market with winning outcome after trading is finished" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: ResolveMarketDto })
  @ApiResponse({ status: 200, description: "Market resolved successfully." })
  async resolveMarket(
    @Param("marketId") marketId: string,
    @Body() dto: ResolveMarketDto,
  ) {
    return this.marketsService.resolveMarket(marketId, dto.winningOutcome, dto.txHash, dto.adminAddress);
  }
}

