import { IsBoolean, IsMongoId, IsOptional, IsString, Length, IsISO8601 } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FeedQueryDto {
  @ApiPropertyOptional({ description: "Profile ID of the viewer", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  viewerProfileId?: string;

  @ApiPropertyOptional({ description: "Alternative viewer profile ID parameter", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: "Filter to only show market posts", example: false })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  onlyMarkets?: boolean;
}

export class CreatePostDto {
  @ApiPropertyOptional({ description: "Author User ID", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @ApiPropertyOptional({ description: "Alternative author profile ID parameter", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @ApiProperty({ description: "Text content of the normal post", example: "Hello Verity prediction markets!" })
  @IsString()
  @Length(1, 1000, { message: "Post content must be between 1 and 1000 characters." })
  content: string;
}

export class CreateMarketPostDto {
  @ApiPropertyOptional({ description: "Author User ID", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  authorId?: string;

  @ApiPropertyOptional({ description: "Alternative author profile ID parameter", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @ApiPropertyOptional({ description: "Optional post content accompanying the market question", example: "Will this event happen?" })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  content?: string;

  @ApiProperty({ description: "Prediction market question", example: "Will Bitcoin reach $100k by end of 2026?" })
  @IsString()
  @Length(1, 240, { message: "Market question is required (max 240 chars)." })
  question: string;

  @ApiProperty({ description: "Category/Tag of the market", example: "crypto" })
  @IsString()
  @Length(1, 60)
  category: string;

  @ApiProperty({ description: "Market betting deadline (ISO date)", example: "2026-12-31T23:59:59.000Z" })
  @IsISO8601({}, { message: "A valid deadline date is required." })
  deadline: string;

  @ApiProperty({ description: "Resolution source description", example: "CoinGecko price feed" })
  @IsString()
  @Length(1, 240)
  resolutionSource: string;

  @ApiProperty({ description: "Conditions for YES resolution", example: "BTC price >= $100,000 on CoinGecko" })
  @IsString()
  @Length(1, 500)
  yesCondition: string;

  @ApiProperty({ description: "Conditions for NO resolution", example: "BTC price < $100,000 on CoinGecko" })
  @IsString()
  @Length(1, 500)
  noCondition: string;

  @ApiProperty({ description: "On-chain 1 USDC creation fee tx hash", example: "0xabc123..." })
  @IsString()
  @Length(1, 120, { message: "Prediction posts require a 1 USDC Arc testnet creation transaction." })
  creationFeeTxHash: string;

  @ApiProperty({ description: "Arc testnet fee collector address", example: "0x28738040d191ff30673f546FB6BF997E6cdA6dbF" })
  @IsString()
  @Length(1, 120, { message: "Prediction posts require the Arc testnet fee collector address." })
  feeCollectorAddress: string;
}
