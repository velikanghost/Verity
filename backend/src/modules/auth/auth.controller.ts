import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, Request } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto } from "./auth.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: any) {
    return this.authService.me(req.user.id);
  }
}
