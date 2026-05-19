import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { LiquidityService } from "./liquidity.service";
import { LiquidityController } from "./liquidity.controller";
import { LiquidityPool, LiquidityPoolSchema, LPPosition, LPPositionSchema, LiquidityEvent, LiquidityEventSchema } from "./liquidity.model";
import { Market, MarketSchema } from "../markets/markets.model";
import { User, UserSchema } from "../users/users.model";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LiquidityPool.name, schema: LiquidityPoolSchema },
      { name: LPPosition.name, schema: LPPositionSchema },
      { name: LiquidityEvent.name, schema: LiquidityEventSchema },
      { name: Market.name, schema: MarketSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [LiquidityController],
  providers: [LiquidityService],
  exports: [LiquidityService],
})
export class LiquidityModule {}
