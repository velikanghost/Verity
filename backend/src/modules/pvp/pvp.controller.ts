import { Controller, Get, Post, Body, UseGuards, Request } from "@nestjs/common"
import { PvpService } from "./pvp.service"
import { CreatePvpEventDto, SubmitTicketDto } from "./pvp.dto"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger"

@ApiTags("pvp")
@Controller("pvp")
export class PvpController {
  constructor(private readonly pvpService: PvpService) {}

  @Post("events")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Admin-only: Deploy a new PvP Parent + 7 Child Markets event" })
  async createPvpEvent(@Request() req: any, @Body() dto: CreatePvpEventDto) {
    return this.pvpService.createPvpEvent(req.user.id, dto)
  }

  @Get("active-events")
  @ApiOperation({ summary: "Fetch all active/unexpired PvP parent matches and child markets" })
  async getActiveEvents() {
    return this.pvpService.getActiveEvents()
  }

  @Post("ticket")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Submit/Queue a prediction ticket for a PvP event" })
  async submitTicket(@Request() req: any, @Body() dto: SubmitTicketDto) {
    return this.pvpService.submitTicket(req.user.id, dto)
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retrieve the current active queued or matched PvP ticket/duel for a user" })
  async getPvpStatus(@Request() req: any) {
    return this.pvpService.getPvpStatus(req.user.id)
  }

  @Get("leaderboards")
  @ApiOperation({ summary: "Fetch PvP leaderboards (Elo rating, accumulative XP, and top referrers)" })
  async getLeaderboards() {
    return this.pvpService.getLeaderboards()
  }

  @Get("referrals")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's referrals progress, double boosts count, and list of referees" })
  async getReferrals(@Request() req: any) {
    return this.pvpService.getReferrals(req.user.id)
  }

  @Get("history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Retrieve past resolved PvP match history for a user" })
  async getMatchHistory(@Request() req: any) {
    return this.pvpService.getMatchHistory(req.user.id)
  }
}
