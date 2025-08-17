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
import { UpdateServiceDto } from '@dto/update-service.dto';
import { UpdateCompanyDto } from '@dto/update-company.dto';
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

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 10 },
      { name: 'videos', maxCount: 5 },
    ]),
  )
  async createService(
    @Body() serviceDto: CreateServiceDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    },
  ) {
    const userId = req.user.userId;
    return this.servicesService.createService(
      serviceDto,
      userId,
      files?.images,
      files?.videos,
    );
  }

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

  @Get('categories')
  async getAllCategoriesWithSubcategories(): Promise<Category[]> {
    return this.servicesService.getAllCategoriesWithSubcategories();
  }

  @Get('company/:id')
  @UseGuards(JwtAuthGuard)
  async getServicesByCompany(
    @Param('id') companyId: string,
  ): Promise<Service[]> {
    return this.servicesService.getServicesByCompany(companyId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getServiceById(@Param('id') serviceId: string): Promise<Service> {
    return this.servicesService.getServiceById(serviceId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 10 },
      { name: 'videos', maxCount: 5 },
    ]),
  )
  async updateService(
    @Param('id') serviceId: string,
    @Body() serviceData: UpdateServiceDto,
    @UploadedFiles()
    files?: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    },
  ): Promise<Service> {
    return this.servicesService.updateService(
      serviceId,
      serviceData,
      files?.images,
      files?.videos,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteService(@Param('id') serviceId: string): Promise<Service> {
    return this.servicesService.deleteService(serviceId);
  }
}
