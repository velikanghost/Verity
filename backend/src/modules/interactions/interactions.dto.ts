import { IsBoolean, IsMongoId } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ToggleInteractionDto {
  @ApiProperty({ description: "Target Post ID", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId({ message: "A valid post id is required." })
  postId: string;

  @ApiProperty({ description: "User Profile ID performing the interaction", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId({ message: "A valid profile id is required." })
  profileId: string;

  @ApiProperty({ description: "Set interaction active status", example: true })
  @IsBoolean({ message: "Current interaction state must be a boolean." })
  currentlyActive: boolean;
}
