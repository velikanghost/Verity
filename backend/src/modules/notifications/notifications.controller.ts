import { Controller, Get, Patch, Post, Param, Query, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse } from "@nestjs/swagger";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get notifications for a user" })
  @ApiQuery({ name: "userId", required: true, description: "User ID to retrieve notifications for" })
  @ApiResponse({ status: 200, description: "List of notifications retrieved successfully." })
  async getUserNotifications(@Query("userId") userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiParam({ name: "id", description: "Notification ID" })
  @ApiBody({ schema: { type: "object", properties: { userId: { type: "string" } } } })
  @ApiResponse({ status: 200, description: "Notification marked as read." })
  async markAsRead(
    @Param("id") id: string,
    @Body("userId") userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications for a user as read" })
  @ApiBody({ schema: { type: "object", properties: { userId: { type: "string" } } } })
  @ApiResponse({ status: 200, description: "All notifications marked as read." })
  async markAllAsRead(@Body("userId") userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }
}
