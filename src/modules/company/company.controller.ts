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
import { CompanyService } from '../company/company.service';
import { UpdateCompanyDto } from 'src/modules/company/dto/update-company.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Company } from '@schemas/company.schema';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Company')
@Controller('company')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly adminService: AdminService,
  ) {}

  /**
   * Get all companies with pagination
   * @param page Page number
   * @param limit Number of companies per page
   * @returns List of companies and total pages
   */
  @Get('company')
  async getAllCompanies(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.companyService.getAllCompanies(page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id') companyId: string,
    @Req() req: RequestWithUser,
  ): Promise<Company> {
    return this.companyService.toggleFavorite(companyId, req.user.userId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'companyImages', maxCount: 10 },
    ]),
  )
  async updateCompany(
    @Body() companyDto: UpdateCompanyDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: {
      profilePicture?: Express.Multer.File[];
      companyImages?: Express.Multer.File[];
    },
  ) {
    const id = req.user.userId;
    return this.companyService.updateCompany(id, companyDto, files);
  }
}
