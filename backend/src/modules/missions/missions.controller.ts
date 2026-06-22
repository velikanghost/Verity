import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common"
import { MissionsService } from "./missions.service"
import { CreateMissionDto, UpdateMissionDto } from "./missions.dto"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { AdminGuard } from "../../common/guards/admin.guard"
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("missions")
@Controller("missions")
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Retrieve all active missions with completion status for the authenticated user",
  })
  async getMissions(@Request() req: any) {
    return this.missionsService.getMissions(req.user.id, false)
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Retrieve all missions (both active and inactive)",
  })
  async getMissionsAdmin(@Request() req: any) {
    return this.missionsService.getMissions(req.user.id, true)
  }

  @Post("link-twitter")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Link the authenticated user's Twitter/X username",
  })
  async linkTwitter(@Request() req: any, @Body() body: { twitterUsername: string }) {
    return this.missionsService.linkTwitterUsername(req.user.id, body.twitterUsername)
  }

  @Post(":id/complete")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Mark a mission as completed and award XP to the authenticated user",
  })
  async completeMission(@Param("id") missionId: string, @Request() req: any) {
    return this.missionsService.completeMission(req.user.id, missionId)
  }

  // --- Admin Endpoints ---

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Create a new mission with a custom XP reward and URL",
  })
  async createMission(@Body() dto: CreateMissionDto) {
    return this.missionsService.createMission(dto)
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin-only: Update a mission's details or toggle active status",
  })
  async updateMission(@Param("id") id: string, @Body() dto: UpdateMissionDto) {
    return this.missionsService.updateMission(id, dto)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Admin-only: Permanently delete a mission from the database",
  })
  async deleteMission(@Param("id") id: string) {
    return this.missionsService.deleteMission(id)
  }
}
