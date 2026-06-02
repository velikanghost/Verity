import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator"
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

export class RequestOtpDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address." })
  @IsNotEmpty()
  email: string
}

export class VerifyOtpDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address." })
  @IsNotEmpty()
  email: string

  @ApiProperty({
    description: "6-digit OTP verification code",
    example: "123456",
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: "OTP must be exactly 6 digits." })
  @Matches(/^\d+$/, { message: "OTP must contain numbers only." })
  code: string

  @ApiPropertyOptional({
    description: "Username for new users",
    example: "crypto_trader",
  })
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "Username can only contain letters, numbers, and underscores.",
  })
  username?: string
}
