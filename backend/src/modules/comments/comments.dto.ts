import { IsMongoId, IsString, Length } from "class-validator";

export class CreateCommentDto {
  @IsMongoId({ message: "A valid post id is required." })
  postId: string;

  @IsMongoId({ message: "A valid profile id is required." })
  profileId: string;

  @IsString()
  @Length(1, 500, { message: "Comment content is required (max 500 chars)." })
  content: string;
}

export class FetchCommentsQueryDto {
  @IsMongoId({ message: "A valid post id is required." })
  postId: string;
}
