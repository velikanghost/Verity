import { IsBoolean, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Length, Min } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FetchMarketsQueryDto {
  @ApiPropertyOptional({ description: "Filter by market status", example: "open_for_votes" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: "Filter by category", example: "crypto" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: "Sort by trending status", example: true })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  trending?: boolean;

  @ApiPropertyOptional({ description: "Sort by newest creation", example: true })
  @IsOptional()
  @Transform(({ value }) => value !== "false" && value !== false)
  @IsBoolean()
  newest?: boolean;

  @ApiPropertyOptional({ description: "Filter to only qualified markets", example: false })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  qualified?: boolean;

  @ApiPropertyOptional({ description: "Filter to only markets open for votes", example: true })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  open_for_votes?: boolean;
}

export class CastFreeVoteDto {
  @ApiPropertyOptional({ description: "User ID casting the vote", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: "Profile ID casting the vote (alias to userId)", example: "60d0fe4f5311236168a109ca" })
  @IsOptional()
  @IsMongoId()
  profileId?: string;

  @ApiProperty({ description: "Side of the vote", enum: ["YES", "NO"], example: "YES" })
  @IsEnum(["YES", "NO"], { message: "Vote side must be YES or NO." })
  side: "YES" | "NO";
}

export class ExecuteTradeDto {
  @ApiProperty({ description: "User Profile ID executing the trade", example: "60d0fe4f5311236168a109ca" })
  @IsMongoId({ message: "A valid profile id is required." })
  profileId: string;

  @ApiProperty({ description: "Side of the prediction trade", enum: ["YES", "NO"], example: "YES" })
  @IsEnum(["YES", "NO"], { message: "Trade side must be YES or NO." })
  side: "YES" | "NO";

  @ApiProperty({ description: "Action type", enum: ["BUY", "SELL"], example: "BUY" })
  @IsEnum(["BUY", "SELL"], { message: "Trade action must be BUY or SELL." })
  action: "BUY" | "SELL";

  @ApiProperty({ description: "USDC amount to spend (net of fees) or tokens to sell", example: 10 })
  @IsNumber()
  @Min(0.0001, { message: "Amount must be greater than 0." })
  amount: number;

  @ApiPropertyOptional({ description: "Calculated fee amount in USDC", example: 0.1 })
  @IsOptional()
  @IsNumber()
  feeAmount?: number;

  @ApiPropertyOptional({ description: "Gross amount (e.g. outcome tokens received)", example: 12.5 })
  @IsOptional()
  @IsNumber()
  grossAmount?: number;

  @ApiPropertyOptional({ description: "On-chain transaction hash", example: "0x123abc..." })
  @IsOptional()
  @IsString()
  @Length(0, 120)
  txHash?: string;
}

