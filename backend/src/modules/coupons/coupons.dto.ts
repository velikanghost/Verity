import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  IsDateString,
} from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateCouponDto {
  @ApiProperty({ description: "Unique coupon code", example: "WELCOME20" })
  @IsString()
  code: string

  @ApiProperty({
    description: "Multiplier granted by the coupon",
    example: 1.5,
  })
  @IsNumber()
  @Min(1.0)
  multiplier: number

  @ApiProperty({
    description: "Maximum uses per user",
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number

  @ApiProperty({
    description: "Maximum total uses for all users",
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTotalUses?: number

  @ApiProperty({
    description: "Expiration date",
    example: "2026-12-31T23:59:59Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string
}

export class UpdateCouponDto {
  @ApiProperty({
    description: "Is the coupon active?",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiProperty({
    description: "Multiplier granted by the coupon",
    example: 1.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  multiplier?: number

  @ApiProperty({
    description: "Maximum uses per user",
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number

  @ApiProperty({
    description: "Maximum total uses for all users",
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTotalUses?: number

  @ApiProperty({
    description: "Expiration date",
    example: "2026-12-31T23:59:59Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
