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
  readonly name: string;

  @ApiProperty({ description: 'Description of the category', required: false })
  @IsOptional()
  @IsString()
  readonly description?: string;
}

/**
 * DTO for creating a subcategory
 */
export class CreateSubcategoryDto {
  @ApiProperty({ description: 'Name of the subcategory', required: true })
  @IsString()
  readonly name: string;

  @ApiProperty({ description: 'Category ID (main category)', required: true })
  @IsMongoId()
  readonly category: string;

  @ApiProperty({ description: 'Description of the subcategory', required: false })
  @IsOptional()
  @IsString()
  readonly description?: string;
}

/**
 * DTO for creating a service
 */
export class CreateServiceDto {
  @ApiProperty({ description: 'Company ID offering the service', required: true })
  @IsMongoId()
  readonly company: string;

  @ApiProperty({ description: 'User ID creating the service', required: true })
  @IsMongoId()
  readonly user: string;

  @ApiProperty({ description: 'Subcategory ID associated with the service', required: true })
  @IsMongoId()
  readonly category: string;

  @ApiProperty({ description: 'Title of the service', required: true })
  @IsString()
  readonly title: string;

  @ApiProperty({ description: 'Description of the service', required: true })
  @IsString()
  readonly description: string;

  @ApiProperty({ description: 'Price of the service', required: false })
  @IsOptional()
  @IsNumber()
  readonly price?: number;

  @ApiProperty({ description: 'Is the service active?', required: false })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

  @ApiProperty({
    description: 'Array of image URLs for the service',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly images?: string[];

  @ApiProperty({
    description: 'Array of video URLs for the service',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly videos?: string[];

  @ApiProperty({
    description: 'Array of tags for the service',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly tags?: string[];
}
