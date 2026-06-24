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

  @ApiProperty({ example: "https://twitter.com/verity" })
  @IsString()
  @IsNotEmpty()
  actionUrl: string

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
  actionUrl?: string

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
}
