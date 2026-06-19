import { Controller, Get, Post, Body, UseGuards, Request, Query, Param } from "@nestjs/common"
import { PvpService } from "./pvp.service"
import { CreatePvpEventDto, SubmitTicketDto } from "./pvp.dto"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { AdminGuard } from "../../common/guards/admin.guard"
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger"

@ApiTags("pvp")
@Controller("pvp")
export class PvpController {
  constructor(private readonly pvpService: PvpService) {}

  @Post("events")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Deploy a new PvP Parent + Child Markets event with dynamic options (min 3)",
  })
  async createPvpEvent(@Request() req: any, @Body() dto: CreatePvpEventDto) {
    return this.pvpService.createPvpEvent(req.user.id, dto)
  }

  @Post("events/:parentMarketId/lock")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Lock a PvP Parent and its Child Markets to prevent further entries/trades",
  })
  async lockPvpEvent(@Request() req: any, @Param("parentMarketId") parentMarketId: string) {
    return this.pvpService.lockPvpEvent(req.user.id, parentMarketId)
  }

  @Get("active-events")
  @ApiOperation({
    summary: "Fetch all active/unexpired PvP parent matches and child markets",
  })
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
  @ApiOperation({
    summary:
      "Retrieve the current active queued or matched PvP ticket/duel for a user",
  })
  async getPvpStatus(
    @Request() req: any,
    @Query("parentMarketId") parentMarketId?: string,
  ) {
    return this.pvpService.getPvpStatus(req.user.id, parentMarketId)
  }

  @Get("leaderboards")
  @ApiOperation({
    summary: "Fetch PvP leaderboards (accumulative XP and top referrers)",
  })
  async getLeaderboards(@Query("userId") userId?: string) {
    return this.pvpService.getLeaderboards(userId)
  }

  @Get("referrals")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get user's referrals progress, XP boosts count, and list of referees",
  })
  async getReferrals(@Request() req: any) {
    return this.pvpService.getReferrals(req.user.id)
  }

  @Get("my-active-tickets")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Retrieve all PvP events where the user has an active (queued/matched) ticket",
  })
  async getMyActiveTickets(@Request() req: any) {
    return this.pvpService.getMyActiveTickets(req.user.id)
  }

  @Get("history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Retrieve past resolved PvP match history for a user",
  })
  async getMatchHistory(@Request() req: any) {
    return this.pvpService.getMatchHistory(req.user.id)
  }

  @Get("claimable-winnings")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Retrieve all unclaimed winning picks across all resolved PvP events for the authenticated user",
  })
  async getClaimableWinnings(@Request() req: any) {
    return this.pvpService.getClaimableWinnings(req.user.id)
  }

  @Get("admin-status")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Get admin wallet balances and market fee details",
  })
  async getAdminStatus(@Request() req: any) {
    return this.pvpService.getAdminStatus(req.user.id)
  }

  @Get("admin-metrics")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Get system database metrics and platform statistics",
  })
  async getAdminMetrics(@Request() req: any) {
    return this.pvpService.getAdminMetrics(req.user.id)
  }

  @Get("public-metrics")
  @ApiOperation({
    summary: "Public: Get system database metrics and platform statistics",
  })
  async getPublicMetrics() {
    return this.pvpService.getPublicMetrics()
  }
}

