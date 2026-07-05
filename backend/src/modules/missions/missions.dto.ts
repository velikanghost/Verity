import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  IsBoolean,
  IsOptional,
  Min,
} from "class-validator"

export class CreateMissionDto {
  @ApiProperty({ example: "Follow Twitter" })
  @IsString()
  @IsNotEmpty()
  title: string

  @ApiPropertyOptional({ example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  xpReward?: number | null

  @ApiPropertyOptional({ example: "https://twitter.com/verity" })
  @IsString()
  @IsOptional()
  actionUrl?: string | null

  @ApiPropertyOptional({ example: "social", enum: ["social", "activity"] })
  @IsString()
  @IsOptional()
  missionType?: "social" | "activity"

  @ApiPropertyOptional({ example: "twitter_follow" })
  @IsString()
  @IsOptional()
  verificationKey?: string | null

  @ApiPropertyOptional({ example: 1.5 })
  @IsNumber()
  @IsOptional()
  rewardMultiplier?: number | null

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  rewardMatchesCount?: number | null

  @ApiPropertyOptional({ example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsOptional()
  marketId?: string | null
}

export class UpdateMissionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  xpReward?: number | null

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actionUrl?: string | null

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  missionType?: "social" | "activity"

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  verificationKey?: string | null

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rewardMultiplier?: number | null

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  rewardMatchesCount?: number | null

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  marketId?: string | null
}
