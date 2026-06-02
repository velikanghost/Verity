import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from "@nestjs/common"
import { NotificationsService } from "./notifications.service"
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get notifications for a user" })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "User ID (optional/ignored)",
  })
  @ApiResponse({
    status: 200,
    description: "List of notifications retrieved successfully.",
  })
  async getUserNotifications(@Request() req: any) {
    return this.notificationsService.getUserNotifications(req.user.id)
  }

  @Patch(":id/read")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiParam({ name: "id", description: "Notification ID" })
  @ApiBody({
    schema: { type: "object", properties: { userId: { type: "string" } } },
  })
  @ApiResponse({ status: 200, description: "Notification marked as read." })
  async markAsRead(@Param("id") id: string, @Request() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id)
  }

  @Post("read-all")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications for a user as read" })
  @ApiBody({
    schema: { type: "object", properties: { userId: { type: "string" } } },
  })
  @ApiResponse({
    status: 200,
    description: "All notifications marked as read.",
  })
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id)
    return { success: true }
  }
}
