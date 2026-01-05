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
import { ApiTags, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Provider } from 'src/modules/provider/schemas/provider.schema';
import { Service } from '@modules/schemas/service.schema';
import { SearchService } from '@services/search.service';
import { CacheService } from 'src/modules/cache/cache.service';
import { JobPost } from '@modules/schemas/job.schema';

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

  @Get('providers/location')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Search providers by location hierarchy with featured promotion',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description: 'Latitude for geo search',
  })
  @ApiQuery({
    name: 'long',
    required: false,
    description: 'Longitude for geo search',
  })
  @ApiQuery({
    name: 'radius',
    required: false,
    description: 'Search radius in meters (default: 10000)',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'State for location search',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country for location search',
  })
  @ApiQuery({
    name: 'featured',
    required: false,
    description: 'If true, returns 70% featured, 30% non-featured providers',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: '1',
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: '10',
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns providers with location hierarchy',
  })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async searchProvidersByLocation(
    @Query('lat') lat?: string,
    @Query('long') long?: string,
    @Query('radius') radius?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
    @Query('featured') featured?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    providers: Provider[];
    totalPages: number;
    page: number;
    hasExactResults: boolean;
    featuredRatio?: number;
  }> {
    const cacheKey = `providers:location:${lat || ''}:${long || ''}:${radius || ''}:${state || ''}:${country || ''}:${featured || ''}:${page || '1'}:${limit || '10'}`;

    const cachedResult = await this.cacheService.get<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const pagination = {
      page: parseInt(page || '1'),
      limit: parseInt(limit || '10'),
      skip: (parseInt(page || '1') - 1) * parseInt(limit || '10'),
    };

    // Use the location-based search with promotion
    if (featured === 'true') {
      const { providers, featuredRatio } = await (
        this.searchService as any
      ).searchProvidersWithPromotion(
        { lat, long, radius, state, country, featured },
        pagination,
      );

      // Get total count for pagination
      const totalCount = await (
        this.searchService as any
      ).getTotalProvidersCount({ lat, long, radius, state, country, featured });
      const totalPages = Math.ceil(totalCount / pagination.limit);

      const result = {
        providers,
        totalPages,
        page: pagination.page,
        hasExactResults: true,
        featuredRatio,
      };

      await this.cacheService.set(cacheKey, result, 300); // Cache for 5 minutes
      return result;
    } else {
      // Normal location-based search without promotion
      const providers = await (
        this.searchService as any
      ).searchProvidersByLocation(
        { lat, long, radius, state, country, featured: false },
        pagination,
      );

      // Get total count for pagination
      const totalCount = await (
        this.searchService as any
      ).getTotalProvidersCount({
        lat,
        long,
        radius,
        state,
        country,
        featured: false,
      });
      const totalPages = Math.ceil(totalCount / pagination.limit);

      const result = {
        providers,
        totalPages,
        page: pagination.page,
        hasExactResults: true,
      };

      await this.cacheService.set(cacheKey, result, 300);
      return result;
    }
  }

  @Get(':model')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Global search across providers, services, and jobs',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: '1',
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: '10',
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'engine',
    required: false,
    description: 'Use enhanced search engine',
  })
  @ApiQuery({
    name: 'searchInput',
    required: false,
    description: 'Text to search',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    description: 'Latitude for location filter',
  })
  @ApiQuery({
    name: 'long',
    required: false,
    description: 'Longitude for location filter',
  })
  @ApiQuery({
    name: 'address',
    required: false,
    description: 'Address for location filter',
  })
  @ApiQuery({
    name: 'radius',
    required: false,
    description: 'Search radius in meters',
  })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort criteria' })
  @ApiQuery({
    name: 'categories',
    required: false,
    description: 'Category filters',
  })
  @ApiQuery({
    name: 'featured',
    required: false,
    description: 'If true, returns mixed featured/non-featured providers',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'State for location hierarchy',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Country for location hierarchy',
  })
  @ApiResponse({ status: 200, description: 'Returns search results' })
  async searchCompanies(
    @Param('model') model: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('engine') engine: string,
    @Query('searchInput') searchInput?: string,
    @Query('lat') lat?: string,
    @Query('long') long?: string,
    @Query('address') address?: string,
    @Query('radius') radius?: string,
    @Query('sortBy') sortBy?: string | string[],
    @Query('categories') categories?: string[],
    @Query('featured') featured?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
  ): Promise<{
    providers?: Provider[];
    services?: Service[];
    jobs?: JobPost[];
    totalPages: number;
    page: number;
    hasExactResults: boolean;
    featuredRatio?: number;
  }> {
    const cacheKey =
      'search:' +
      `${model}:${engine}:${searchInput || ''}:` +
      `${lat || ''}:${long || ''}:${address || ''}:` +
      `${radius || ''}:${sortBy || ''}:${(categories || []).join(',')}:` +
      `${featured || ''}:${state || ''}:${country || ''}:${page}:${limit}`;

    const cachedResult = await this.cacheService.get<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const sortByArray = Array.isArray(sortBy)
      ? sortBy
      : sortBy
        ? sortBy
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const result = await this.searchService.globalSearch({
      page,
      limit,
      model,
      radius,
      engine,
      searchInput,
      lat,
      long,
      address,
      sortBy: sortByArray,
      categories,
      featured,
      state,
      country,
    });

    await this.cacheService.set(cacheKey, result, 300); // Cache for 5 mins
    return result;
  }

  @Get('media/featured')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get featured media content with location-based providers',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'lat', required: false })
  @ApiQuery({ name: 'long', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'country', required: false })
  async getFeaturedMedia(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('lat') lat?: string,
    @Query('long') long?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
  ): Promise<{
    providers: Provider[];
    totalPages: number;
    page: number;
    featuredRatio: number;
  }> {
    const cacheKey = `media:featured:${lat || ''}:${long || ''}:${state || ''}:${country || ''}:${page || '1'}:${limit || '10'}`;

    const cachedResult = await this.cacheService.get<any>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const pagination = {
      page: parseInt(page || '1'),
      limit: parseInt(limit || '10'),
      skip: (parseInt(page || '1') - 1) * parseInt(limit || '10'),
    };

    const { providers, featuredRatio } = await (
      this.searchService as any
    ).searchProvidersWithPromotion(
      { lat, long, state, country, featured: 'true' },
      pagination,
    );

    // Get total count
    const totalCount = await (this.searchService as any).getTotalProvidersCount(
      { lat, long, state, country, featured: 'true' },
    );
    const totalPages = Math.ceil(totalCount / pagination.limit);

    const result = {
      providers,
      totalPages,
      page: pagination.page,
      featuredRatio,
    };

    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }
}
