import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsNotEmpty, IsNumber, IsString, IsUrl, IsBoolean, IsOptional, Min } from "class-validator"

export class CreateMissionDto {
  @ApiProperty({ example: "Follow Twitter" })
  @IsString()
  @IsNotEmpty()
  title: string


  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  xpReward: number

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
  xpReward?: number

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
}
