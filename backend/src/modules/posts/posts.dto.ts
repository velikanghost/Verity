import { IsBoolean, IsMongoId, IsOptional, IsString, Length, IsISO8601 } from "class-validator";
import { Transform } from "class-transformer";

export class FeedQueryDto {
  @IsOptional()
  @IsMongoId()
  viewerProfileId?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  onlyMarkets?: boolean;
}

export class CreatePostDto {
  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @IsString()
  @Length(1, 1000, { message: "Post content must be between 1 and 1000 characters." })
  content: string;
}

export class CreateMarketPostDto {
  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  content?: string;

  @IsString()
  @Length(1, 240, { message: "Market question is required (max 240 chars)." })
  question: string;

  @IsString()
  @Length(1, 60)
  category: string;

  @IsISO8601({}, { message: "A valid deadline date is required." })
  deadline: string;

  @IsString()
  @Length(1, 240)
  resolutionSource: string;

  @IsString()
  @Length(1, 500)
  yesCondition: string;

  @IsString()
  @Length(1, 500)
  noCondition: string;

  @IsString()
  @Length(1, 120, { message: "Prediction posts require a 1 USDC Arc testnet creation transaction." })
  creationFeeTxHash: string;

  @IsString()
  @Length(1, 120, { message: "Prediction posts require the Arc testnet fee collector address." })
  feeCollectorAddress: string;
}
