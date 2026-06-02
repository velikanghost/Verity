import { IsString, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize, IsEnum, IsNotEmpty } from "class-validator"
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

  @ApiProperty({ description: "Official resolution source details", example: "ESPN / FIFA Official site" })
  @IsString()
  @IsNotEmpty()
  resolutionSource: string

  @ApiProperty({ description: "Exactly 7 proposition questions/options", type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  options: string[]
}

export class PvpPickInput {
  @ApiProperty({ description: "Child market option ID" })
  @IsString()
  @IsNotEmpty()
  marketId: string

  @ApiProperty({ description: "User choice", enum: ["YES", "NO"] })
  @IsEnum(["YES", "NO"])
  selection: "YES" | "NO"
}

export class SubmitTicketDto {
  @ApiProperty({ description: "Parent market event ID" })
  @IsString()
  @IsNotEmpty()
  parentMarketId: string

  @ApiProperty({ description: "Exactly 7 picks on options", type: [PvpPickInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PvpPickInput)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  picks: PvpPickInput[]
}
