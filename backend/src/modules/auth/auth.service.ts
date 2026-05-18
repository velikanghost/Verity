import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { User, UserDocument } from "../users/users.model";
import { RegisterDto, LoginDto } from "./auth.dto";

export interface UserResponse {
  id: string;
  wallet_address: string | null;
  walletAddress: string | null;
  username: string;
  display_name: string | null;
  displayName: string | null;
  avatar_url: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followersCount: number;
  followingCount: number;
  signalPoints: number;
  freeVotesCorrect: number;
  freeVotesWrong: number;
  freeVotesTotal: number;
  created_at: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeUser(user: UserDocument): UserResponse {
  const createdAt = user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString();
  const updatedAt = user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString();

  return {
    id: user.id || (user as any)._id?.toString(),
    wallet_address: user.walletAddress,
    walletAddress: user.walletAddress,
    username: user.username,
    display_name: user.displayName,
    displayName: user.displayName,
    avatar_url: user.avatarUrl,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    signalPoints: user.signalPoints,
    freeVotesCorrect: user.freeVotesCorrect,
    freeVotesWrong: user.freeVotesWrong,
    freeVotesTotal: user.freeVotesTotal,
    created_at: createdAt,
    createdAt,
    updatedAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  private signToken(payload: { id: string; email?: string }): string {
    return this.jwtService.sign(payload);
  }

  async register(input: RegisterDto) {
    const existing = await this.userModel.findOne({
      $or: [{ email: input.email.toLowerCase() }, { username: input.username }],
    });

    if (existing) {
      throw new ConflictException("Email or username is already in use.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.userModel.create({
      email: input.email.toLowerCase(),
      passwordHash,
      username: input.username,
      displayName: input.display_name || null,
    });

    return {
      token: this.signToken({ id: user.id, email: user.email || undefined }),
      user: serializeUser(user),
    };
  }

  async login(input: LoginDto) {
    const user = await this.userModel.findOne({ email: input.email.toLowerCase() });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return {
      token: this.signToken({ id: user.id, email: user.email || undefined }),
      user: serializeUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return serializeUser(user);
  }
}
