import { IsOptional, IsString, Length } from "class-validator";

export class UpdateUserDto {
  @IsString()
  @Length(3, 32, { message: "Username must be 3-32 characters." })
  username: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  display_name?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  avatar_url?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 280)
  bio?: string | null;
}
