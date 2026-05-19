import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from "@nestjs/common";
import { LiquidityService } from "./liquidity.service";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery, ApiResponse, ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber, IsNotEmpty } from "class-validator";

class FundPoolDto {
  @ApiProperty({ description: "Creator User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @ApiProperty({ description: "Creator wallet address link", example: "0x28738040d191ff30673f546FB6BF997E6cdA6dbF" })
  @IsString()
  @IsNotEmpty()
  creatorWallet: string;

  @ApiProperty({ description: "On-chain escrow fund transaction hash", example: "0x123abc..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

class AddLiquidityDto {
  @ApiProperty({ description: "LP User ID", example: "60d0fe4f5311236168a109cb" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: "USDC amount deposited as liquidity", example: 30 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: "Transaction hash of the addLiquidity operation", example: "0x456def..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

class RemoveLiquidityDto {
  @ApiProperty({ description: "LP User ID", example: "60d0fe4f5311236168a109cb" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: "LP shares to withdraw/burn", example: 30 })
  @IsNumber()
  lpShares: number;

  @ApiProperty({ description: "Transaction hash of the removeLiquidity operation", example: "0x789ghi..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

@ApiTags("liquidity")
@Controller("markets")
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post(":marketId/fund-pool")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Initialize and fund a prediction market's liquidity pool (Escrow 10 USDC)" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: FundPoolDto })
  @ApiResponse({ status: 200, description: "Pool initialized and creator deposit recorded." })
  async fundPool(
    @Param("marketId") marketId: string,
    @Body() dto: FundPoolDto,
  ) {
    return this.liquidityService.initializePool(marketId, dto.creatorId, dto.creatorWallet, dto.txHash);
  }

  @Post(":marketId/add-liquidity")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Add USDC liquidity to an active prediction market pool" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: AddLiquidityDto })
  @ApiResponse({ status: 200, description: "Liquidity successfully added." })
  async addLiquidity(
    @Param("marketId") marketId: string,
    @Body() dto: AddLiquidityDto,
  ) {
    return this.liquidityService.addLiquidity(marketId, dto.userId, dto.amount, dto.txHash);
  }

  @Post(":marketId/remove-liquidity")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Withdraw USDC liquidity from a prediction market pool (Subject to 24h lock)" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: RemoveLiquidityDto })
  @ApiResponse({ status: 200, description: "Liquidity successfully withdrawn." })
  async removeLiquidity(
    @Param("marketId") marketId: string,
    @Body() dto: RemoveLiquidityDto,
  ) {
    return this.liquidityService.removeLiquidity(marketId, dto.userId, dto.lpShares, dto.txHash);
  }

  @Get(":marketId/pool")
  @ApiOperation({ summary: "Get the detailed state of a prediction market's liquidity pool (Yes/No ratios and pricing)" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiResponse({ status: 200, description: "Pool state fetched successfully." })
  async getPoolState(@Param("marketId") marketId: string) {
    return this.liquidityService.getPoolState(marketId);
  }

  @Get(":marketId/lp-positions")
  @ApiOperation({ summary: "Get liquidity provider shares and position for a user in a market pool" })
  @ApiParam({ name: "marketId", description: "Market ID", example: "60d0fe4f5311236168a109ca" })
  @ApiQuery({ name: "userId", description: "User ID to fetch LP positions for" })
  @ApiResponse({ status: 200, description: "LP positions retrieved successfully." })
  async getUserPositions(
    @Param("marketId") marketId: string,
    @Query("userId") userId: string,
  ) {
    return this.liquidityService.getUserPositions(marketId, userId);
  }
}

