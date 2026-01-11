import {
  IsOptional,
  IsBoolean,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum SearchModel {
  PROVIDERS = 'providers',
  SERVICES = 'services',
  JOBS = 'jobs',
}

export enum SortBy {
  RELEVANCE = 'Relevance',
  NEWEST = 'Newest',
  OLDEST = 'Oldest',
  TOP_RATED = 'Top Rated',
  MOST_REVIEWED = 'Most Reviewed',
}

export class GlobalSearchDto {
  @ApiProperty({ enum: SearchModel, default: SearchModel.PROVIDERS })
  @IsEnum(SearchModel)
  model: SearchModel;

  @IsNumber()
  @Type(() => Number)
  page: number;

  @IsNumber()
  @Type(() => Number)
  limit: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  engine?: boolean;

  @IsOptional()
  @IsString()
  searchInput?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  long?: number;

  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    // Handle both comma-separated string and already-parsed array
    if (typeof value === 'string') {
      // Split by comma and filter out empty strings
      return value.split(',').filter((item) => item.trim() !== '');
    }
    return value;
  })
  subcategories?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  featured?: boolean;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number;
}
