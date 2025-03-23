import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ServicesService } from './services.service';
import { CreateServiceDto } from '@dto/create-service.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 10 }]))
  async createService(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles() files: { files?: Express.Multer.File[] },
  ) {
    if (!files || !files.files) {
      throw new BadRequestException('Files are required');
    }
    return this.servicesService.createService(createServiceDto, files.files);
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

  @Get()
  async getServices() {
    return this.servicesService.getServices();
  }

  @Get(':id')
  async getServiceById(@Param('id') id: string) {
    return this.servicesService.getServiceById(id);
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

  @Get('random/:count')
  async getRandomServices(@Param('count') count: number) {
    return this.servicesService.getRandomServices(count);
  }
}
