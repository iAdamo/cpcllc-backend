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
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Company } from 'src/modules/company/schemas/company.schema';
import { Service } from '@modules/schemas/service.schema';
import { SearchService } from '@services/search.service';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('companies')
  async searchCompanies(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('engine') engine: string,
    @Query('searchInput') searchInput?: string,
    @Query('lat') lat?: string,
    @Query('long') long?: string,
    @Query('address') address?: string,
  ): Promise<{
    companies: Company[];
    services: Service[];
    totalPages: number;
  }> {
    return await this.searchService.globalSearch(
      page,
      limit,
      engine,
      searchInput,
      lat,
      long,
      address,
    );
  }
}
