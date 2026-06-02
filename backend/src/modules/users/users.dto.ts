import { IsOptional, IsString, Length, IsBoolean } from "class-validator"
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class UpdateUserDto {
  @ApiProperty({ description: "Updated unique username", example: "johndoe2" })
  @IsString()
  @Length(3, 32, { message: "Username must be 3-32 characters." })
  username: string

  @ApiPropertyOptional({
    description: "Updated display name",
    example: "John Doe Senior",
  })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  display_name?: string | null

  @ApiPropertyOptional({
    description: "Updated avatar image URL",
    example: "https://example.com/avatar.png",
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  avatar_url?: string | null

  @ApiPropertyOptional({
    description: "Updated user bio",
    example: "Prediction market enthusiast",
  })
  @IsOptional()
  @IsString()
  @Length(0, 280)
  bio?: string | null

  @ApiPropertyOptional({
    description: "Onboarding completed flag",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isOnboarded?: boolean

  @ApiPropertyOptional({
    description: "Referral code",
    example: "johndoe",
  })
  @IsOptional()
  @IsString()
  referrerUsername?: string
}
