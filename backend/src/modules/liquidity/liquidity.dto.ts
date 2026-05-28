import { IsString, IsNumber, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class FundPoolDto {
  @ApiProperty({ description: "Creator User ID", example: "60d0fe4f5311236168a109ca" })
  @IsString()
  @IsNotEmpty()
  creatorId: string;

  @ApiProperty({ description: "Creator wallet address link", example: "0x28738040d191ff30673f546FB6BF997E6cdA6dbF" })
  @IsString()
  @IsNotEmpty()
  creatorWallet: string;

  @ApiProperty({ description: "On-chain escrow fund transaction hash", example: "0x123abc..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

export class AddLiquidityDto {
  @ApiProperty({ description: "LP User ID", example: "60d0fe4f5311236168a109cb" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: "USDC amount deposited as liquidity", example: 30 })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: "Transaction hash of the addLiquidity operation", example: "0x456def..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

export class RemoveLiquidityDto {
  @ApiProperty({ description: "LP User ID", example: "60d0fe4f5311236168a109cb" })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: "LP shares to withdraw/burn", example: 30 })
  @IsNumber()
  lpShares: number;

  @ApiProperty({ description: "Transaction hash of the removeLiquidity operation", example: "0x789ghi..." })
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

