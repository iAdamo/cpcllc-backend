import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
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
  async search(@Query() query: GlobalSearchDto) {
    console.log(query);
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
      subcategories,
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
      (subcategories ?? []).join(','),
      featured ?? '',
      city ?? '',
      state ?? '',
      country ?? '',
      page,
      limit,
    ].join(':');
  }
}
