import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
  Request,
} from "@nestjs/common"
import { CouponsService } from "./coupons.service"
import { CreateCouponDto, UpdateCouponDto } from "./coupons.dto"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import * as jwt from "jsonwebtoken"

@Controller("coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get("validate/:code")
  async validateCoupon(@Request() req: any, @Param("code") code: string) {
    const authHeader = req.headers["authorization"]
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null

    let userId: string | undefined
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET || ""
        const decoded = jwt.verify(token, jwtSecret) as any
        if (decoded && decoded.id) {
          userId = decoded.id
        }
      } catch (e) {
        // Ignore invalid token, just treat as guest
      }
    }

    const coupon = await this.couponsService.validateCoupon(code, userId)
    return {
      success: true,
      data: {
        code: coupon.code,
        multiplier: coupon.multiplier,
      },
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createCoupon(
    @Request() req: any,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateCouponDto,
  ) {
    return this.couponsService.create(req.user.id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllCoupons(@Request() req: any) {
    return this.couponsService.findAll(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async updateCoupon(
    @Request() req: any,
    @Param("id") id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(req.user.id, id, dto)
  }
}
