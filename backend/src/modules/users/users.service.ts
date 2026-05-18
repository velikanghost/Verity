import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./users.model";
import { serializeUser } from "../auth/auth.service";
import { UpdateUserDto } from "./users.dto";

export const DEV_USERNAME = "JudeSignal";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  private normalizeWallet(address: string): string {
    return address.trim().toLowerCase();
  }

  private defaultUsername(address: string): string {
    return `user_${address.slice(-4).toLowerCase()}_${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  async ensureDevUser() {
    const user = await this.userModel.findOneAndUpdate(
      { username: DEV_USERNAME },
      {
        $setOnInsert: {
          username: DEV_USERNAME,
          displayName: DEV_USERNAME,
          walletAddress: "dev-judesignal",
          bio: "Development user for local Verity testing.",
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    return serializeUser(user);
  }

  async getDevUser() {
    return this.ensureDevUser();
  }

  async getOrCreateByWallet(walletAddress: string) {
    const wallet = this.normalizeWallet(walletAddress);
    const existing = await this.userModel.findOne({ walletAddress: wallet });
    if (existing) return serializeUser(existing);

    const created = await this.userModel.create({
      walletAddress: wallet,
      username: this.defaultUsername(wallet),
      displayName: `User ${wallet.slice(-4).toUpperCase()}`,
    });

    return serializeUser(created);
  }

  async updateUser(id: string, input: UpdateUserDto) {
    const updated = await this.userModel.findByIdAndUpdate(
      id,
      {
        username: input.username,
        displayName: input.display_name || null,
        avatarUrl: input.avatar_url || null,
        bio: input.bio || null,
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      throw new NotFoundException("User not found.");
    }
    return serializeUser(updated);
  }

  async findUserById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException("User not found.");
    }
    return user;
  }
}
