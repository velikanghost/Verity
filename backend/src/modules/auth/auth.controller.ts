import { Controller, Get, Post, Body, UseGuards, Request } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { RequestOtpDto, VerifyOtpDto } from "./auth.dto"
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger"

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiResponse({ status: 200, description: "Current user profile fetched." })
  async me(@Request() req: any) {
    return this.authService.me(req.user.id)
  }

  @Post("request-otp")
  @ApiOperation({
    summary: "Request a 6-digit OTP verification code sent to email",
  })
  @ApiResponse({
    status: 200,
    description: "OTP generated and logged to console.",
  })
  async requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body.email)
  }

  @Post("verify-otp")
  @ApiOperation({ summary: "Verify 6-digit OTP code to login or signup" })
  @ApiResponse({ status: 200, description: "OTP verified, returns local JWT." })
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.email, body.code, body.username)
  }
}
