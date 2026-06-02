import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from "@nestjs/common"
import { LiquidityService } from "./liquidity.service"
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger"
import {
  FundPoolDto,
  AddLiquidityDto,
  RemoveLiquidityDto,
} from "./liquidity.dto"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"

@ApiTags("liquidity")
@Controller("markets")
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityService) {}

  @Post(":marketId/fund-pool")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Initialize and fund a prediction market's liquidity pool (Escrow 10 USDC)",
  })
  @ApiParam({
    name: "marketId",
    description: "Market ID",
    example: "60d0fe4f5311236168a109ca",
  })
  @ApiBody({ type: FundPoolDto })
  @ApiResponse({
    status: 200,
    description: "Pool initialized and creator deposit recorded.",
  })
  async fundPool(
    @Param("marketId") marketId: string,
    @Body() dto: FundPoolDto,
    @Request() req: any,
  ) {
    const creatorId = req.user.id
    return this.liquidityService.initializePool(
      marketId,
      creatorId,
      dto.creatorWallet,
      dto.txHash,
    )
  }

  @Post(":marketId/add-liquidity")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Add USDC liquidity to an active prediction market pool",
  })
  @ApiParam({
    name: "marketId",
    description: "Market ID",
    example: "60d0fe4f5311236168a109ca",
  })
  @ApiBody({ type: AddLiquidityDto })
  @ApiResponse({ status: 200, description: "Liquidity successfully added." })
  async addLiquidity(
    @Param("marketId") marketId: string,
    @Body() dto: AddLiquidityDto,
    @Request() req: any,
  ) {
    const userId = req.user.id
    return this.liquidityService.addLiquidity(
      marketId,
      userId,
      dto.amount,
      dto.txHash,
    )
  }

  @Post(":marketId/remove-liquidity")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Withdraw USDC liquidity from a prediction market pool (Subject to 24h lock)",
  })
  @ApiParam({
    name: "marketId",
    description: "Market ID",
    example: "60d0fe4f5311236168a109ca",
  })
  @ApiBody({ type: RemoveLiquidityDto })
  @ApiResponse({
    status: 200,
    description: "Liquidity successfully withdrawn.",
  })
  async removeLiquidity(
    @Param("marketId") marketId: string,
    @Body() dto: RemoveLiquidityDto,
    @Request() req: any,
  ) {
    const userId = req.user.id
    return this.liquidityService.removeLiquidity(
      marketId,
      userId,
      dto.lpShares,
      dto.txHash,
    )
  }

  @Get(":marketId/pool")
  @ApiOperation({
    summary:
      "Get the detailed state of a prediction market's liquidity pool (Yes/No ratios and pricing)",
  })
  @ApiParam({
    name: "marketId",
    description: "Market ID",
    example: "60d0fe4f5311236168a109ca",
  })
  @ApiResponse({ status: 200, description: "Pool state fetched successfully." })
  async getPoolState(@Param("marketId") marketId: string) {
    return this.liquidityService.getPoolState(marketId)
  }

  @Get(":marketId/lp-positions")
  @ApiOperation({
    summary:
      "Get liquidity provider shares and position for a user in a market pool",
  })
  @ApiParam({
    name: "marketId",
    description: "Market ID",
    example: "60d0fe4f5311236168a109ca",
  })
  @ApiQuery({
    name: "userId",
    description: "User ID to fetch LP positions for",
  })
  @ApiResponse({
    status: 200,
    description: "LP positions retrieved successfully.",
  })
  async getUserPositions(
    @Param("marketId") marketId: string,
    @Query("userId") userId: string,
  ) {
    return this.liquidityService.getUserPositions(marketId, userId)
  }
}
