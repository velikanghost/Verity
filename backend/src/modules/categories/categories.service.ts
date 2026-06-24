import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { Category, CategoryDocument } from "./categories.model"
import { CreateCategoryDto, UpdateCategoryDto } from "./categories.dto"
import { User, UserDocument } from "../users/users.model"

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async validateAdmin(adminId: string): Promise<void> {
    const admin = await this.userModel.findById(adminId)
    if (!admin || admin.role !== "admin") {
      throw new ForbiddenException("Only admins can perform this action.")
    }
  }

  async create(
    adminId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    await this.validateAdmin(adminId)

    const cleanSlug = dto.slug.toLowerCase().trim()
    const existing = await this.categoryModel.findOne({ slug: cleanSlug })
    if (existing) {
      throw new ConflictException("Category with this slug already exists.")
    }

    const category = new this.categoryModel({
      slug: cleanSlug,
      displayName: dto.displayName.trim(),
      isActive: true,
    })
    return category.save()
  }

  async findAllAdmin(adminId: string): Promise<CategoryDocument[]> {
    await this.validateAdmin(adminId)
    return this.categoryModel.find().sort({ createdAt: -1 })
  }

  async findAllPublic(): Promise<CategoryDocument[]> {
    return this.categoryModel.find({ isActive: true }).sort({ slug: 1 })
  }

  async update(
    adminId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    await this.validateAdmin(adminId)

    const category = await this.categoryModel.findById(id)
    if (!category) {
      throw new NotFoundException("Category not found.")
    }

    if (dto.displayName !== undefined)
      category.displayName = dto.displayName.trim()
    if (dto.isActive !== undefined) category.isActive = dto.isActive

    return category.save()
  }
}
