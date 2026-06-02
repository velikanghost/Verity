import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common"
import { CircleWalletService } from "./circle-wallet.service"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger"

@ApiTags("circle-wallet")
@ApiBearerAuth()
@Controller("circle-wallet")
export class CircleWalletController {
  constructor(private readonly circleWalletService: CircleWalletService) {}

  @Post("execute-batch")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      "Execute a batch of contract calls on behalf of the user using Circle SCA wallet",
  })
  @ApiResponse({
    status: 201,
    description: "Batch transaction successfully executed and mined.",
  })
  async executeBatch(
    @Request() req: any,
    @Body("calls")
    calls: Array<{
      contractAddress: string
      abiFunctionSignature: string
      abiParameters: any[]
    }>,
    @Body("estimatedCostUsdc") estimatedCostUsdc?: number,
  ) {
    const txHash = await this.circleWalletService.executeBatch(
      req.user.id,
      calls,
      estimatedCostUsdc,
    )
    return { txHash }
  }
}
