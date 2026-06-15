import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { Request } from "express"
import * as jwt from "jsonwebtoken"
import { User, UserDocument } from "../../modules/users/users.model"

export interface AuthUser {
  id: string
  email?: string
  walletAddress?: string
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>()
    const authHeader = request.headers["authorization"]
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.")
    }

    let decoded: any
    try {
      const jwtSecret = process.env.JWT_SECRET || ""
      decoded = jwt.verify(token, jwtSecret) as any
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error
          ? error.message
          : "Invalid or expired session token.",
      )
    }

    if (!decoded || !decoded.id) {
      throw new UnauthorizedException("Invalid token payload.")
    }

    // Look up user by ID
    // If the database fails (e.g. timeout, network drop), it will throw a 500 error instead of 401
    const user = await this.userModel.findById(decoded.id)

    if (!user) {
      throw new UnauthorizedException("User not registered.")
    }

    request.user = {
      id: user.id || (user as any)._id?.toString(),
      email: user.email || undefined,
      walletAddress: user.walletAddress || undefined,
    }

    return true
  }
}
