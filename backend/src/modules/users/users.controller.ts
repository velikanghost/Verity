import { Body, Controller, Get, Param, Patch, UseGuards, Inject, forwardRef } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./users.dto";
import { MarketsService } from "../markets/markets.service";
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => MarketsService))
    private readonly marketsService: MarketsService,
  ) {}

  @Get("dev")
  @ApiOperation({ summary: "Get or create a mock/dev user for testing" })
  @ApiResponse({ status: 200, description: "Dev user fetched successfully." })
  async getDevUser() {
    return this.usersService.getDevUser();
  }

  @Get("wallet/:walletAddress")
  @ApiOperation({ summary: "Get or create user by their on-chain wallet address" })
  @ApiParam({ name: "walletAddress", description: "Ethereum/Arc address", example: "0x28738040d191ff30673f546FB6BF997E6cdA6dbF" })
  @ApiResponse({ status: 200, description: "User fetched or created successfully." })
  async getOrCreateWalletUser(@Param("walletAddress") walletAddress: string) {
    return this.usersService.getOrCreateByWallet(walletAddress);
  }

  @Get(":id/daily-votes")
  @ApiOperation({ summary: "Get daily vote limits and usage for a user" })
  @ApiParam({ name: "id", description: "User profile ID", example: "60d0fe4f5311236168a109ca" })
  @ApiResponse({ status: 200, description: "Daily votes status retrieved." })
  async getUserDailyVotes(@Param("id") id: string) {
    return this.marketsService.getDailyVotes(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update user profile details" })
  @ApiParam({ name: "id", description: "User ID", example: "60d0fe4f5311236168a109ca" })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: "Profile updated successfully." })
  async updateUser(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }
}
