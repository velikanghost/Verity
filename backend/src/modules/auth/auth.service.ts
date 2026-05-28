import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/users.model';

export interface UserResponse {
  id: string;
  wallet_address: string | null;
  walletAddress: string | null;
  email?: string | null;
  privyDid?: string | null;
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
  const createdAt = user.createdAt
    ? new Date(user.createdAt).toISOString()
    : new Date().toISOString();
  const updatedAt = user.updatedAt
    ? new Date(user.updatedAt).toISOString()
    : new Date().toISOString();

  return {
    id: user.id || (user as any)._id?.toString(),
    wallet_address: user.walletAddress,
    walletAddress: user.walletAddress,
    email: user.email,
    privyDid: user.privyDid,
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
  ) {}

  async me(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return serializeUser(user);
  }
}
