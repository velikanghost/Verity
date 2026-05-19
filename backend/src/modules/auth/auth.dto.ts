import { IsEmail, IsOptional, IsString, Length, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ description: "User email address", example: "user@example.com" })
  @IsEmail({}, { message: "A valid email is required." })
  email: string;

  @ApiProperty({ description: "User password (min 8 chars)", example: "password123" })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters." })
  password: string;

  @ApiProperty({ description: "User name/handle", example: "johndoe" })
  @IsString()
  @Length(3, 32, { message: "Username must be 3-32 characters." })
  username: string;

  @ApiPropertyOptional({ description: "Optional display name", example: "John Doe" })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  display_name?: string | null;
}

export class LoginDto {
  @ApiProperty({ description: "User email address", example: "user@example.com" })
  @IsEmail({}, { message: "A valid email is required." })
  email: string;

  @ApiProperty({ description: "User password", example: "password123" })
  @IsString()
  password: string;
}
