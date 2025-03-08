import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from '@services/services.service';
import { CreateServiceDto } from '@dto/create-service.dto';

@Controller('services')
export class ServicesController {
    constructor(private readonly servicesService: ServicesService) {}

    @Post('')
    async createService(@Body() createServiceDto: CreateServiceDto) {
        return this.servicesService.createService(createServiceDto);
    }
}
