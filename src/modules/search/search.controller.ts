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
import { Provider } from 'src/modules/provider/schemas/provider.schema';
import { Service } from '@modules/schemas/service.schema';
import { SearchService } from '@services/search.service';
import { CacheService } from 'src/cache/cache.service';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('providers')
  async searchCompanies(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('engine') engine: string,
    @Query('searchInput') searchInput?: string,
    @Query('lat') lat?: string,
    @Query('long') long?: string,
    @Query('address') address?: string,
    @Query('sortBy') sortBy?: string,
  ): Promise<{
    companies: Provider[];
    services: Service[];
    totalPages: number;
  }> {
    const cacheKey = `search:providers:${page}:${limit}:${engine}:${searchInput}:${lat}:${long}:${address}:${sortBy}`;
    const cachedResult = await this.cacheService.get<{
      companies: Provider[];
      services: Service[];
      totalPages: number;
    }>(cacheKey);
    if (!cachedResult) {
      const result = await this.searchService.globalSearch(
        page,
        limit,
        engine,
        searchInput,
        lat,
        long,
        address,
        sortBy,
      );
      await this.cacheService.set(cacheKey, result, 3600); // Cache for 1 hour
      return result;
    }
    return cachedResult;
  }
}
