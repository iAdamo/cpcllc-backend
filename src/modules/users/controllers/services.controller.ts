import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@schemas/user.schema';
import {
  Service,
  CategorySchema,
  Subcategory,
  Category,
} from '@modules/schemas/service.schema';
import { ServicesService } from '@modules/services/services.service';
import { CreateUserDto } from '@modules/dto/create-user.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import {
  CreateCategoryDto,
  CreateSubcategoryDto,
  CreateServiceDto,
} from '@modules/dto/create-service.dto';
import { UpdateCompanyUserDto } from '@dto/update-company.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Company } from '@schemas/company.schema';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('category')
  async createCategory(
    @Body() categoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return this.servicesService.createCategory(categoryDto);
  }

  @Post('subcategory')
  async createSubcategory(
    @Body() subcategoryDto: CreateSubcategoryDto,
  ): Promise<Subcategory> {
    return this.servicesService.createSubcategory(subcategoryDto);
  }

  @Post('service')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'serviceImages', maxCount: 10 }]),
  )
  async createService(
    @Body() serviceDto: CreateServiceDto,
    @Req() req: RequestWithUser,
    @Query('companyId') companyId: string,
    @UploadedFiles()
    files?: { serviceImages?: Express.Multer.File[] },
  ): Promise<Service> {
    const userId = req.user.userId;
    return this.servicesService.createService(
      serviceDto,
      userId,
      companyId,
      files?.serviceImages,
    );
  }

  @Get('categories')
  async getAllCategoriesWithSubcategories(): Promise<Category[]> {
    return this.servicesService.getAllCategoriesWithSubcategories();
  }
}
