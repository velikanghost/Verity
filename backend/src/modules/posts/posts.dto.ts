import { IsBoolean, IsMongoId, IsOptional, IsString, Length, IsISO8601, IsNotEmpty, IsNumber } from "class-validator";
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

  @ApiPropertyOptional({ description: "Profile ID to filter by for activity tab view", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @ApiPropertyOptional({ description: "Activity tab to filter by (posts, markets, comments, likes, reshares)", example: "posts" })
  @IsOptional()
  @IsString()
  tab?: string;
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
  @Length(1, 600)
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

  @ApiPropertyOptional({ description: "Pyth price feed ID", example: "0xe62665949c883f9e0f6f002eac32e00bd59dfe6c34e92a91c37d6a8322d6489" })
  @IsOptional()
  @IsString()
  priceFeedId?: string;

  @ApiPropertyOptional({ description: "Pyth target resolution price (scaled by feed exponent)", example: 60000 })
  @IsOptional()
  @IsNumber()
  targetPrice?: number;

  @ApiPropertyOptional({ description: "True to resolve YES if price >= targetPrice, false if price < targetPrice", example: true })
  @IsOptional()
  @IsBoolean()
  resolveAbove?: boolean;

  @ApiPropertyOptional({ description: "Pre-generated Market ID / MongoDB ObjectId hex string", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  marketId?: string;
}

export class CreatePostUnifiedDto {
  @ApiProperty({ description: 'Post type', enum: ['normal', 'market'], example: 'normal' })
  @IsString()
  @IsNotEmpty()
  type: 'normal' | 'market';

  @ApiProperty({ description: 'Post content', example: 'Hello Verity!' })
  @IsString()
  @Length(1, 1000)
  content: string;

  // Market-only fields — all optional at the DTO level, validated in service
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 240) question?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() deadline?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 600) resolutionSource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) yesCondition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 500) noCondition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() creationFeeTxHash?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() feeCollectorAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priceFeedId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() targetPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() resolveAbove?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() marketId?: string;
}

export class AddCommentDto {
  @ApiPropertyOptional({ description: "Author User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional({ description: "Alternative profile ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: "Comment body content", example: "This is a great market!" })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: "Optional parent Comment ID", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId()
  @IsOptional()
  parentId?: string;
}

export class ToggleLikeDto {
  @ApiPropertyOptional({ description: "User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: "Alternative profile ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: "Set active like status", example: true })
  @IsBoolean()
  currentlyActive: boolean;
}

export class ToggleReshareDto {
  @ApiPropertyOptional({ description: "User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: "Alternative profile ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ description: "Set active reshare status", example: true })
  @IsBoolean()
  currentlyActive: boolean;
}

export class ValidateMarketPostDto {
  @ApiProperty({ description: "Market question", example: "Will BTC reach $100k?" })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: "Category of the market", example: "Crypto" })
  @IsString()
  @IsNotEmpty()
  @Length(1, 60)
  category: string;

  @ApiProperty({ description: "Betting deadline", example: "2026-12-31T23:59:59.000Z" })
  @IsISO8601({}, { message: "A valid deadline date is required." })
  deadline: string;

  @ApiProperty({ description: "Resolution source", example: "CoinGecko" })
  @IsString()
  @IsNotEmpty()
  @Length(1, 600)
  resolutionSource: string;

  @ApiProperty({ description: "YES resolution details", example: "Price >= $100,000" })
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  yesCondition: string;

  @ApiProperty({ description: "NO resolution details", example: "Price < $100,000" })
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  noCondition: string;
}
