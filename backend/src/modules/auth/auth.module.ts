import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { JwtModule } from "@nestjs/jwt"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { User, UserSchema, OtpCode, OtpCodeSchema } from "../users/users.model"
import { AuthService } from "./auth.service"
import { AuthController } from "./auth.controller"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { CircleWalletModule } from "../circle-wallet/circle-wallet.module"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: OtpCode.name, schema: OtpCodeSchema },
    ]),
    CircleWalletModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          "JWT_SECRET",
          "replace-with-a-long-random-secret-before-production",
        ),
        signOptions: {
          expiresIn: config.get<string>("JWT_EXPIRES_IN", "7d") as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
