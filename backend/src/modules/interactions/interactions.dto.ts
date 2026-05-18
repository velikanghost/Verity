import { IsBoolean, IsMongoId } from "class-validator";

export class ToggleInteractionDto {
  @IsMongoId({ message: "A valid post id is required." })
  postId: string;

  @IsMongoId({ message: "A valid profile id is required." })
  profileId: string;

  @IsBoolean({ message: "Current interaction state must be a boolean." })
  currentlyActive: boolean;
}
