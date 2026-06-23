import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
  Request,
} from "@nestjs/common"
import { CategoriesService } from "./categories.service"
import { CreateCategoryDto, UpdateCategoryDto } from "./categories.dto"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getActiveCategories() {
    return this.categoriesService.findAllPublic()
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin")
  async getAllCategoriesAdmin(@Request() req: any) {
    return this.categoriesService.findAllAdmin(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createCategory(
    @Request() req: any,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(req.user.id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async updateCategory(
    @Request() req: any,
    @Param("id") id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(req.user.id, id, dto)
  }
}
