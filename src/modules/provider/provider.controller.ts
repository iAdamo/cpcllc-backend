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
import { AdminService } from '../admin/admin.service';
import { ProviderService } from './provider.service';
import { CreateProviderDto } from '@dto/create-provider.dto';
import { UpdateProviderDto } from '@dto/update-provider.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Provider } from 'src/modules/provider/schemas/provider.schema';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    phoneNumber: string;
    userId: string;
  };
}

@ApiTags('Provider')
@Controller('provider')
export class ProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Get all companies with pagination
   * @param page Page number
   * @param limit Number of companies per page
   * @returns List of companies and total pages
   */
  @Get('provider')
  async getAllCompanies(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.providerService.getAllCompanies(page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id') providerId: string,
    @Req() req: RequestWithUser,
  ): Promise<Provider> {
    return this.providerService.toggleFavorite(providerId, req.user.userId);
  }

  @Post('')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'providerLogo',
        maxCount: 1,
      },
      { name: 'providerImages', maxCount: 10 },
    ]),
  )
  async createProvider(
    @Body() providerDto: CreateProviderDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: {
      providerLogo?: Express.Multer.File[];
      providerImages?: Express.Multer.File[];
    },
  ) {
    const user = req.user;
    return this.providerService.createProvider(providerDto, user, files);
  }

  @Patch('')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      {
        name: 'providerLogo',
        maxCount: 1,
      },
      { name: 'providerImages', maxCount: 10 },
    ]),
  )
  async updateProvider(
    @Body() providerDto: UpdateProviderDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: {
      providerLogo?: Express.Multer.File[];
      providerImages?: Express.Multer.File[];
    },
  ) {
    const user = req.user;
    return this.providerService.updateProvider(providerDto, user, files);
  }
}
