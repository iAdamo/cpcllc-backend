import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { SearchService } from '@services/search.service';
import { CacheService } from 'src/modules/cache/cache.service';
import { GlobalSearchDto } from './dto/search.dto';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Global search across providers, services, and jobs',
  })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @ApiQuery({ name: 'engine', required: false })
  @ApiQuery({ name: 'searchInput', required: false })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'long', required: false })
  @ApiQuery({ name: 'address', required: false })
  @ApiQuery({ name: 'radius', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'categories', required: false, isArray: true })
  @ApiQuery({ name: 'featured', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query() query: GlobalSearchDto) {
    const cacheKey = this.buildCacheKey(query);

    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.searchService.globalSearch(query);

    await this.cacheService.set(cacheKey, result, 300); // 5 minutes
    return result;
  }

  /**
   * Generates a stable cache key based on search params
   */
  private buildCacheKey(query: GlobalSearchDto): string {
    const {
      model,
      engine,
      searchInput,
      lat,
      long,
      address,
      radius,
      sortBy,
      categories,
      featured,
      city,
      state,
      country,
      page,
      limit,
    } = query;

    return [
      'search',
      model,
      engine ? 'engine' : 'discovery',
      searchInput ?? '',
      lat ?? '',
      long ?? '',
      address ?? '',
      radius ?? '',
      sortBy ?? '',
      (categories ?? []).join(','),
      featured ?? '',
      city ?? '',
      state ?? '',
      country ?? '',
      page,
      limit,
    ].join(':');
  }
}
