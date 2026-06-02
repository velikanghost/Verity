import { Module, Global } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { Notification, NotificationSchema } from "./notifications.model"
import { User, UserSchema } from "../users/users.model"
import { NotificationsService } from "./notifications.service"
import { NotificationsController } from "./notifications.controller"
import { SocketModule } from "../socket/socket.module"

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SocketModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
