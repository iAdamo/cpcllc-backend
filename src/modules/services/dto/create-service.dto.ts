import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';

/**
 * DTO for creating a category
 */
export class CreateCategoryDto {
  @ApiProperty({ description: 'Name of the category', required: true })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the category', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for creating a subcategory
 */
export class CreateSubcategoryDto {
  @ApiProperty({ description: 'Name of the subcategory', required: true })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Category ID (main category)', required: true })
  @IsMongoId()
  category: string;

  @ApiProperty({
    description: 'Description of the subcategory',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * DTO for creating a service
 */
export class CreateServiceDto {
  @ApiProperty({
    description: 'Subcategory ID associated with the service',
    required: true,
  })
  @IsMongoId()
  subcategoryId: string;

  @ApiProperty({ description: 'Title of the service', required: true })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Description of the service', required: true })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Minimum price of the service', required: false })
  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @ApiProperty({ description: 'Maximum price of the service', required: false })
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @ApiProperty({ description: 'TIme duration of the service', required: false })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiProperty({ description: 'Is the service active?', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Array of media URLs for the service',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
