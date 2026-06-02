import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Request,
} from "@nestjs/common"
import { InteractionsService } from "./interactions.service"
import { ToggleInteractionDto } from "./interactions.dto"
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"

@ApiTags("interactions")
@ApiBearerAuth()
@Controller("interactions")
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post("like")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle like status on a post" })
  @ApiResponse({
    status: 200,
    description: "Like status successfully toggled.",
  })
  async toggleLike(@Body() dto: ToggleInteractionDto, @Request() req: any) {
    const userId = req.user.id
    await this.interactionsService.toggleLike(
      dto.postId,
      userId,
      dto.currentlyActive,
    )
    return null
  }

  @Post("reshare")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle reshare status on a post" })
  @ApiResponse({
    status: 200,
    description: "Reshare status successfully toggled.",
  })
  async toggleReshare(@Body() dto: ToggleInteractionDto, @Request() req: any) {
    const userId = req.user.id
    await this.interactionsService.toggleReshare(
      dto.postId,
      userId,
      dto.currentlyActive,
    )
    return null
  }
}
