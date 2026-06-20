import { IsString, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, IsEnum, IsNotEmpty, IsOptional } from "class-validator"
import { Type } from "class-transformer"
import { ApiProperty } from "@nestjs/swagger"

export class CreatePvpEventDto {
  @ApiProperty({ description: "Title or main question of the PvP match", example: "USA vs Paraguay" })
  @IsString()
  @IsNotEmpty()
  question: string

  @ApiProperty({ description: "Deadline date when the event starts and predictions lock", example: "2026-06-20T18:00:00Z" })
  @IsString()
  @IsNotEmpty()
  deadline: string

  @ApiProperty({ description: "Optional lock date when kickoff starts and predictions/trading lock", example: "2026-06-20T18:00:00Z", required: false })
  @IsString()
  @IsOptional()
  lockTime?: string

  @ApiProperty({ description: "Official resolution source details", example: "ESPN / FIFA Official site" })
  @IsString()
  @IsNotEmpty()
  resolutionSource: string

  @ApiProperty({ description: "Proposition questions/options (minimum 3)", type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(3)
  options: string[]
}

export class PvpPickInput {
  @ApiProperty({ description: "Child market option ID" })
  @IsString()
  @IsNotEmpty()
  marketId: string

  @ApiProperty({ description: "User choice (YES, NO, or custom outcome name)" })
  @IsString()
  @IsNotEmpty()
  selection: string
}

export class SubmitTicketDto {
  @ApiProperty({ description: "Parent market event ID" })
  @IsString()
  @IsNotEmpty()
  parentMarketId: string

  @ApiProperty({ description: "Picks on options (minimum 3)", type: [PvpPickInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PvpPickInput)
  @ArrayMinSize(3)
  picks: PvpPickInput[]

  @ApiProperty({ description: "Optional coupon code for XP multiplier", required: false })
  @IsOptional()
  @IsString()
  couponCode?: string
}
