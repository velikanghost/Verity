import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { User, UserDocument } from "../../modules/users/users.model"

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userPayload = request.user

    if (!userPayload || !userPayload.id) {
      return false
    }

    const user = await this.userModel.findById(userPayload.id)
    if (!user || user.role !== "admin") {
      throw new ForbiddenException("Admin access required.")
    }

    return true
  }
}
