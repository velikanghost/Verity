import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { User, UserSchema } from "../users/users.model";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET", "replace-with-a-long-random-secret-before-production"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN", "7d") as any,
        },
      }),
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
