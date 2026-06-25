import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"
import { Coupon, CouponDocument } from "./coupon.model"
import { CreateCouponDto, UpdateCouponDto } from "./coupons.dto"
import { User, UserDocument } from "../users/users.model"

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async validateAdmin(adminId: string): Promise<void> {
    const admin = await this.userModel.findById(adminId)
    if (!admin || admin.role !== "admin") {
      throw new ForbiddenException("Only admins can perform this action.")
    }
  }

  async create(adminId: string, dto: CreateCouponDto): Promise<CouponDocument> {
    await this.validateAdmin(adminId)

    const existing = await this.couponModel.findOne({
      code: dto.code.toUpperCase(),
    })
    if (existing) {
      throw new ConflictException("Coupon code already exists.")
    }

    const coupon = new this.couponModel({
      code: dto.code.toUpperCase(),
      multiplier: dto.multiplier,
      maxUsesPerUser: dto.maxUsesPerUser ?? 1,
      maxTotalUses: dto.maxTotalUses ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    })
    return coupon.save()
  }

  async findAll(adminId: string): Promise<CouponDocument[]> {
    await this.validateAdmin(adminId)
    return this.couponModel.find().sort({ createdAt: -1 })
  }

  async update(
    adminId: string,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<CouponDocument> {
    await this.validateAdmin(adminId)

    const coupon = await this.couponModel.findById(id)
    if (!coupon) {
      throw new NotFoundException("Coupon not found.")
    }

    if (dto.isActive !== undefined) coupon.isActive = dto.isActive
    if (dto.multiplier !== undefined) coupon.multiplier = dto.multiplier
    if (dto.maxUsesPerUser !== undefined)
      coupon.maxUsesPerUser = dto.maxUsesPerUser
    if (dto.maxTotalUses !== undefined) coupon.maxTotalUses = dto.maxTotalUses
    if (dto.expiresAt !== undefined)
      coupon.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null

    return coupon.save()
  }

  async validateCoupon(code: string, userId?: string): Promise<CouponDocument> {
    const coupon = await this.couponModel.findOne({ code: code.toUpperCase() })
    if (!coupon) {
      throw new NotFoundException("Invalid coupon code.")
    }
    if (!coupon.isActive) {
      throw new BadRequestException("Coupon is no longer active.")
    }
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      throw new BadRequestException("Coupon has expired.")
    }
    if (
      coupon.maxTotalUses !== null &&
      coupon.currentTotalUses >= coupon.maxTotalUses
    ) {
      throw new BadRequestException("Coupon usage limit reached.")
    }

    if (userId) {
      const userUsageCount = await this.userModel.db.collection("pvptickets").countDocuments({
        userId: new Types.ObjectId(userId),
        couponCode: coupon.code,
        status: { $ne: "cancelled" }
      })
      if (userUsageCount >= coupon.maxUsesPerUser) {
        throw new BadRequestException(`You have already used this coupon code the maximum allowed number of times (${coupon.maxUsesPerUser}).`)
      }
    }

    return coupon
  }

  async incrementUsage(code: string): Promise<void> {
    await this.couponModel.updateOne(
      { code: code.toUpperCase() },
      { $inc: { currentTotalUses: 1 } },
    )
  }
}
