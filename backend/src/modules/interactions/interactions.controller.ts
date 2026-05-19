import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { InteractionsService } from "./interactions.service";
import { ToggleInteractionDto } from "./interactions.dto";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("interactions")
@Controller("interactions")
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post("like")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle like status on a post" })
  @ApiResponse({ status: 200, description: "Like status successfully toggled." })
  async toggleLike(@Body() dto: ToggleInteractionDto) {
    await this.interactionsService.toggleLike(dto.postId, dto.profileId, dto.currentlyActive);
    return null;
  }

  @Post("reshare")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Toggle reshare status on a post" })
  @ApiResponse({ status: 200, description: "Reshare status successfully toggled." })
  async toggleReshare(@Body() dto: ToggleInteractionDto) {
    await this.interactionsService.toggleReshare(dto.postId, dto.profileId, dto.currentlyActive);
    return null;
  }
}
