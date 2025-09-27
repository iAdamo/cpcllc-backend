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
import { ServicesService } from '@services/services.service';
import {
  CreateCategoryDto,
  CreateSubcategoryDto,
  CreateServiceDto,
} from '@modules/dto/create-service.dto';
import { UpdateServiceDto } from '@dto/update-service.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { CacheService } from 'src/modules/cache/cache.service';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly cacheService: CacheService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async createService(
    @Body() serviceDto: CreateServiceDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: { media?: Express.Multer.File[] },
  ) {
    const user = req.user;
    return this.servicesService.createService(serviceDto, user, files);
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
    const cacheKey = 'services:categories-with-subcategories';
    const cachedResult = await this.cacheService.get<Category[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    const result =
      await this.servicesService.getAllCategoriesWithSubcategories();
    await this.cacheService.set(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  }

  @Get('provider/:id')
  @UseGuards(JwtAuthGuard)
  async getServicesByProvider(
    @Param('id') providerId: string,
  ): Promise<Service[]> {
    return this.servicesService.getServicesByProvider(providerId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getServiceById(@Param('id') serviceId: string): Promise<Service> {
    return this.servicesService.getServiceById(serviceId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async updateService(
    @Param('id') serviceId: string,
    @Body() serviceData: UpdateServiceDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: { media?: Express.Multer.File[] },
  ): Promise<Service> {
    return this.servicesService.updateService(
      serviceId,
      serviceData,
      req.user,
      files,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteService(@Param('id') serviceId: string): Promise<Service> {
    return this.servicesService.deleteService(serviceId);
  }
}
