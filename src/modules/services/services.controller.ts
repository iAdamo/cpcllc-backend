import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from '@services/services.service';
import { CreateServiceDto } from '@dto/create-service.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post('')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'files', maxCount: 10 }]))
  async createService(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles() files: { files?: Express.Multer.File[] },
  ) {
    return this.servicesService.createService(
      createServiceDto,
      files.files || [],
    );
  }
}
