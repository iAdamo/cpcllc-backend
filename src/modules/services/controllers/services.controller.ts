import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ServicesService } from '../services/services.service';
import { CreateServiceDto } from '@dto/create-service.dto';
import { ApiTags } from '@nestjs/swagger';
import { Services } from '@schemas/services.schema';
import { Request } from 'express';
import { User } from '@schemas/user.schema'; // Adjust path as needed

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

  @Post('')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'primary', maxCount: 1 },
      { name: 'secondary', maxCount: 1 },
      { name: 'tertiary', maxCount: 1 },
    ]),
  )
  async createService(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles()
    files: {
      primary?: Express.Multer.File[];
      secondary?: Express.Multer.File[];
      tertiary?: Express.Multer.File[];
    },
  ) {
    // Validate that at least the primary image is provided
    if (!files || !files.primary || files.primary.length === 0) {
      throw new BadRequestException('Primary image is required');
    }

    // Map the files to the `media` structure expected by the service
    const media = {
      image: {
        primary: files.primary[0]?.path || null,
        secondary: files.secondary?.[0]?.path || null,
        tertiary: files.tertiary?.[0]?.path || null,
      },
      video: {
        primary: null, // Handle videos if needed
        secondary: null,
        tertiary: null,
      },
    };

    // Add the media object to the DTO
    createServiceDto.media = media;

    const allFiles = [
      ...(files.primary || []),
      ...(files.secondary || []),
      ...(files.tertiary || []),
    ];
    return this.servicesService.createService(createServiceDto, allFiles);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 10 }]))
  async updateService(
    @Param('id') id: string,
    @Body() updateServiceDto: CreateServiceDto,
    @UploadedFiles() files: { files?: Express.Multer.File[] },
  ) {
    return this.servicesService.updateService(
      id,
      updateServiceDto,
      files.files || [],
    );
  }

  @Delete(':id')
  async deleteService(@Param('id') id: string) {
    return this.servicesService.deleteService(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getServices(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ): Promise<{ services: Services[]; totalPages: number }> {
    return this.servicesService.getServices(page, limit);
  }

  @Get('category/:category')
  async getServicesByCategory(@Param('category') category: string) {
    return this.servicesService.getServicesByCategory(category);
  }

  @Get('search/:search')
  async searchServices(@Param('search') search: string) {
    return this.servicesService.searchServices(search);
  }

  /**
   * get random services
   * @param count number of services to return
   * @returns random services
   */
  @UseGuards(JwtAuthGuard)
  @Get('random')
  async getRandomServices(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ): Promise<{ services: Services[]; totalPages: number }> {
    return this.servicesService.getRandomServices(page, limit);
  }

  @Get(':id')
  async getServiceById(@Param('id') id: string) {
    return this.servicesService.getServiceById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id') serviceId: string,
    @Req() req: RequestWithUser,
  ): Promise<Services> {
    return this.servicesService.toggleFavorite(serviceId, req.user.userId);
  }
}
