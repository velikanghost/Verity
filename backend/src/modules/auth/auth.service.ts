import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import {
  User,
  UserDocument,
  OtpCode,
  OtpCodeDocument,
} from "../users/users.model"
import { CircleWalletService } from "../circle-wallet/circle-wallet.service"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { Resend } from "resend"

export interface UserResponse {
  id: string
  wallet_address: string | null
  walletAddress: string | null
  email?: string | null
  username: string
  display_name: string | null
  displayName: string | null
  avatar_url: string | null
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  followingCount: number
  signalPoints: number
  freeVotesCorrect: number
  freeVotesWrong: number
  freeVotesTotal: number
  created_at: string
  createdAt: string
  updatedAt: string
  isOnboarded: boolean
  referredById: string | null
  arenaXp: number
  doubleBoostRemaining: number
  downtimeBoostRemaining: number
  hasWonFirstPvpDuel: boolean
  pvpTicketsSubmittedCount: number
  pvpMatchesWonCount: number
  pvpMatchesLostCount: number
  pvpMatchesDrawnCount: number
  role?: string
  twitterUsername?: string | null
}

export function serializeUser(user: UserDocument): UserResponse {
  const createdAt = user.createdAt
    ? new Date(user.createdAt).toISOString()
    : new Date().toISOString()
  const updatedAt = user.updatedAt
    ? new Date(user.updatedAt).toISOString()
    : new Date().toISOString()

  return {
    id: user.id || (user as any)._id?.toString(),
    wallet_address: user.walletAddress,
    walletAddress: user.walletAddress,
    email: user.email,
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
    isOnboarded: user.isOnboarded || false,
    referredById: user.referredById ? user.referredById.toString() : null,
    arenaXp: user.arenaXp ?? 0,
    doubleBoostRemaining: (user.activeBoosts || [])
      .filter((b: any) => b.source === "referral" && b.type === "match_based")
      .reduce((sum: number, b: any) => sum + (b.matchesRemaining || 0), 0),
    downtimeBoostRemaining: (user.activeBoosts || [])
      .filter((b: any) => b.source === "downtime" && b.type === "match_based")
      .reduce((sum: number, b: any) => sum + (b.matchesRemaining || 0), 0),
    hasWonFirstPvpDuel: user.hasWonFirstPvpDuel ?? false,
    pvpTicketsSubmittedCount: user.pvpTicketsSubmittedCount ?? 0,
    pvpMatchesWonCount: user.pvpMatchesWonCount ?? 0,
    pvpMatchesLostCount: user.pvpMatchesLostCount ?? 0,
    pvpMatchesDrawnCount: user.pvpMatchesDrawnCount ?? 0,
    role: user.role,
    twitterUsername: user.twitterUsername || null,
  }
}

export function placeholderUserProfile(authorId: string): UserResponse {
  new Logger("UserProfileFallback").warn(
    `User profile lookup failed for authorId: ${authorId}, falling back to placeholder profile`,
  )
  const now = new Date().toISOString()
  return {
    id: authorId,
    wallet_address: null,
    walletAddress: null,
    username: "unknown",
    display_name: "Unknown",
    displayName: "Unknown",
    avatar_url: null,
    avatarUrl: null,
    bio: null,
    followersCount: 0,
    followingCount: 0,
    signalPoints: 0,
    freeVotesCorrect: 0,
    freeVotesWrong: 0,
    freeVotesTotal: 0,
    created_at: now,
    createdAt: now,
    updatedAt: now,
    isOnboarded: false,
    referredById: null,
    arenaXp: 0,
    doubleBoostRemaining: 0,
    downtimeBoostRemaining: 0,
    hasWonFirstPvpDuel: false,
    pvpTicketsSubmittedCount: 0,
    pvpMatchesWonCount: 0,
    pvpMatchesLostCount: 0,
    pvpMatchesDrawnCount: 0,
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(OtpCode.name) private otpCodeModel: Model<OtpCodeDocument>,
    private circleWalletService: CircleWalletService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async me(userId: string) {
    const user = await this.userModel.findById(userId)
    if (!user) {
      this.logger.warn(`User profile lookup failed for user ID: ${userId}`)
      throw new NotFoundException("User not found.")
    }
    this.logger.log(
      `User profile retrieved successfully for user ID: ${userId}`,
    )
    return serializeUser(user)
  }

  async requestOtp(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase()

    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes validity

    // Delete existing OTPs for this email to prevent garbage accumulation
    await this.otpCodeModel.deleteMany({ email: normalizedEmail })

    // Store in DB
    await this.otpCodeModel.create({
      email: normalizedEmail,
      code,
      expiresAt,
    })

    const resendApiKey = this.configService.get<string>("RESEND_API_KEY")
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey)
        const fromEmail =
          this.configService.get<string>("RESEND_FROM_EMAIL") ||
          "onboarding@resend.dev"
        await resend.emails.send({
          from: `Verity Auth <${fromEmail}>`,
          to: normalizedEmail,
          subject: "Your Verity Access Code",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
              <h2 style="color: #4f46e5; margin-bottom: 16px;">Verity Identity</h2>
              <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Enter the following 6-digit verification code to complete your login or registration:</p>
              <div style="font-family: monospace; font-size: 28px; font-weight: bold; background-color: #f3f4f6; text-align: center; padding: 16px; margin: 24px 0; border-radius: 8px; letter-spacing: 4px; color: #1f2937;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
            </div>
          `,
        })
        this.logger.log(
          `OTP verification email sent via Resend to: ${normalizedEmail}`,
        )
        if (this.configService.get<string>("NODE_ENV") === "development") {
          this.logger.log(
            `[DEV ONLY] OTP code for ${normalizedEmail} is: ${code}`,
          )
        }
        return {
          success: true,
          message: "An OTP verification code was sent to your email address.",
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to send OTP verification email to ${normalizedEmail}: ${err.message}`,
        )
        throw new BadRequestException(`Failed to send email: ${err.message}`)
      }
    } else {
      this.logger.error("RESEND_API_KEY is not set.")
      throw new InternalServerErrorException("Email service is not configured.")
    }
  }

  async verifyOtp(
    email: string,
    code: string,
    requestedUsername?: string,
  ): Promise<{ token: string; user: UserResponse }> {
    const normalizedEmail = email.trim().toLowerCase()

    // Find the latest valid OTP code
    const otpDoc = await this.otpCodeModel.findOne({
      email: normalizedEmail,
      code,
      expiresAt: { $gt: new Date() },
    })

    if (!otpDoc) {
      throw new BadRequestException("Invalid or expired OTP.")
    }

    // Delete all OTP codes for this email so it can't be reused
    await this.otpCodeModel.deleteMany({ email: normalizedEmail })

    // Check if user already exists
    let user = await this.userModel.findOne({ email: normalizedEmail })
    let isNewUser = false

    if (!user) {
      isNewUser = true
      this.logger.log(`Registering new user with email: ${normalizedEmail}`)

      // Generate or find a unique username
      let username = requestedUsername
        ? requestedUsername.trim()
        : normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_")

      if (!username || username.length < 3) {
        username = `user_${Math.floor(1000 + Math.random() * 9000)}`
      }

      // Check if username is already taken
      let existingUsername = await this.userModel.findOne({
        username: { $regex: new RegExp(`^${username}$`, "i") },
      })

      while (existingUsername) {
        username = `${username}_${Math.floor(100 + Math.random() * 900)}`
        existingUsername = await this.userModel.findOne({
          username: { $regex: new RegExp(`^${username}$`, "i") },
        })
      }

      // Create user record (no wallet address yet)
      user = await this.userModel.create({
        email: normalizedEmail,
        username,
        displayName: username.charAt(0).toUpperCase() + username.slice(1),
        isOnboarded: false,
      })
    }

    // Provision Circle SCA Wallet if the user doesn't have one
    if (!user.circleWalletId) {
      this.logger.log(
        `Provisioning on-chain Circle SCA Wallet for user ID: ${user._id}`,
      )
      try {
        await this.circleWalletService.createWalletForUser(user._id.toString())
        // Fetch reloaded user to get walletAddress and circleWalletId
        user = await this.userModel.findById(user._id)
      } catch (err) {
        this.logger.error(
          `Failed to provision Circle wallet during verification: ${err.message}`,
        )
        // If this is a new user and wallet creation fails, delete user to prevent half-created states
        if (isNewUser && user) {
          await this.userModel.findByIdAndDelete(user._id)
        }
        throw new BadRequestException(`Wallet setup failed: ${err.message}`)
      }
    }

    if (!user) {
      throw new BadRequestException(
        "Verification failed during user record creation.",
      )
    }

    // Generate JWT token
    const payload = { id: user._id.toString(), email: user.email }
    const token = this.jwtService.sign(payload)

    return {
      token,
      user: serializeUser(user),
    }
  }
}
