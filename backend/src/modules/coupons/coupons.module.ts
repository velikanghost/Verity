import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { CouponsController } from "./coupons.controller"
import { CouponsService } from "./coupons.service"
import { Coupon, CouponSchema } from "./coupon.model"
import { User, UserSchema } from "../users/users.model"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
