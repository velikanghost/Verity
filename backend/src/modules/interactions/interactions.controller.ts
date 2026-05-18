import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { InteractionsService } from "./interactions.service";
import { ToggleInteractionDto } from "./interactions.dto";

@Controller("interactions")
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post("like")
  @HttpCode(HttpStatus.OK)
  async toggleLike(@Body() dto: ToggleInteractionDto) {
    await this.interactionsService.toggleLike(dto.postId, dto.profileId, dto.currentlyActive);
    return null;
  }

  @Post("reshare")
  @HttpCode(HttpStatus.OK)
  async toggleReshare(@Body() dto: ToggleInteractionDto) {
    await this.interactionsService.toggleReshare(dto.postId, dto.profileId, dto.currentlyActive);
    return null;
  }
}
