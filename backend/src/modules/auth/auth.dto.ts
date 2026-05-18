import { IsEmail, IsOptional, IsString, Length, MinLength } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "A valid email is required." })
  email: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters." })
  password: string;

  @IsString()
  @Length(3, 32, { message: "Username must be 3-32 characters." })
  username: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  display_name?: string | null;
}

export class LoginDto {
  @IsEmail({}, { message: "A valid email is required." })
  email: string;

  @IsString()
  password: string;
}
