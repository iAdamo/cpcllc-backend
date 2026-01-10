import {
  IsOptional,
  IsBoolean,
  IsNumberString,
  IsString,
  IsArray,
} from 'class-validator';

export class GlobalSearchDto {
  @IsString()
  model: 'providers' | 'services' | 'jobs';

  @IsNumberString()
  page: string;

  @IsNumberString()
  limit: string;

  @IsOptional()
  @IsBoolean()
  engine?: boolean;

  @IsOptional()
  @IsString()
  searchInput?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  lat?: string;

  @IsOptional()
  @IsString()
  long?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'Relevance' | 'Newest' | 'Oldest' | 'Top Rated' | 'Most Reviewed';

  @IsOptional()
  @IsArray()
  categories?: string[];

  @IsOptional()
  @IsBoolean()
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
  @IsString()
  radius?: string;
}
