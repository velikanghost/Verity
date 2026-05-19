import { IsMongoId, IsString, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCommentDto {
  @ApiProperty({ description: "Post ID to add comment to", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId({ message: "A valid post id is required." })
  postId: string;

  @ApiProperty({ description: "User Profile ID adding the comment", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId({ message: "A valid profile id is required." })
  profileId: string;

  @ApiProperty({ description: "Content of the comment", example: "I disagree with this prediction!" })
  @IsString()
  @Length(1, 500, { message: "Comment content is required (max 500 chars)." })
  content: string;
}

export class FetchCommentsQueryDto {
  @ApiProperty({ description: "Post ID to get comments for", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId({ message: "A valid post id is required." })
  postId: string;
}
