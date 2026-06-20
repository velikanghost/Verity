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

@Controller("coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get("validate/:code")
  async validateCoupon(@Param("code") code: string) {
    const coupon = await this.couponsService.validateCoupon(code)
    return {
      success: true,
      code: coupon.code,
      multiplier: coupon.multiplier,
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
