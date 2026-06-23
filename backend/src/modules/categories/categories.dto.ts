import { IsString, IsBoolean, IsOptional } from "class-validator"
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class CreateCategoryDto {
  @ApiProperty({ description: "Category unique slug (lowercase)", example: "football" })
  @IsString()
  slug: string

  @ApiProperty({ description: "Category display name", example: "Football" })
  @IsString()
  displayName: string
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: "Category display name", example: "Football" })
  @IsOptional()
  @IsString()
  displayName?: string

  @ApiPropertyOptional({ description: "Is the category active?", example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
