import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

export interface AuthUser {
  id: string;
  email?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authHeader = request.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }
}
