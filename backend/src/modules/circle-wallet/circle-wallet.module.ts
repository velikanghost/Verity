import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { CircleWalletService } from "./circle-wallet.service"
import { NanopaymentsService } from "./nanopayments.service"
import { CircleWalletController } from "./circle-wallet.controller"
import { User, UserSchema } from "../users/users.model"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [CircleWalletController],
  providers: [CircleWalletService, NanopaymentsService],
  exports: [CircleWalletService, NanopaymentsService],
})
export class CircleWalletModule {}
