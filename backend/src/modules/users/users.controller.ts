import { Body, Controller, Get, Param, Patch, UseGuards, Inject, forwardRef } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./users.dto";
import { MarketsService } from "../markets/markets.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => MarketsService))
    private readonly marketsService: MarketsService,
  ) {}

  @Get("dev")
  async getDevUser() {
    return this.usersService.getDevUser();
  }

  @Get("wallet/:walletAddress")
  async getOrCreateWalletUser(@Param("walletAddress") walletAddress: string) {
    return this.usersService.getOrCreateByWallet(walletAddress);
  }

  @Get(":id/daily-votes")
  async getUserDailyVotes(@Param("id") id: string) {
    return this.marketsService.getDailyVotes(id);
  }

  @Patch(":id")
  async updateUser(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }
}
