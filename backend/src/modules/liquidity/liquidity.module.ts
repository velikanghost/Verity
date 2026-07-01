import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { LiquidityService } from "./liquidity.service"
import { LpFeeService } from "./lp-fee.service"
import { LiquidityController } from "./liquidity.controller"
import {
  LiquidityPool,
  LiquidityPoolSchema,
  LPPosition,
  LPPositionSchema,
  LiquidityEvent,
  LiquidityEventSchema,
  LpFeeLedger,
  LpFeeLedgerSchema,
} from "./liquidity.model"
import { Market, MarketSchema, MarketTrade, MarketTradeSchema } from "../markets/markets.model"
import { User, UserSchema } from "../users/users.model"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LiquidityPool.name, schema: LiquidityPoolSchema },
      { name: LPPosition.name, schema: LPPositionSchema },
      { name: LiquidityEvent.name, schema: LiquidityEventSchema },
      { name: LpFeeLedger.name, schema: LpFeeLedgerSchema },
      { name: Market.name, schema: MarketSchema },
      { name: MarketTrade.name, schema: MarketTradeSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [LiquidityController],
  providers: [LiquidityService, LpFeeService],
  exports: [LiquidityService, LpFeeService],
})
export class LiquidityModule {}
