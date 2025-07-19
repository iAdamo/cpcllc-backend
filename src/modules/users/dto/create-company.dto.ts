import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsMongoId,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompanySocialMediaDto {
  @ApiProperty({ description: 'Facebook URL', required: false })
  @IsOptional()
  @IsString()
  facebook?: string;

  @ApiProperty({ description: 'Twitter URL', required: false })
  @IsOptional()
  @IsString()
  twitter?: string;

  @ApiProperty({ description: 'Instagram URL', required: false })
  @IsOptional()
  @IsString()
  instagram?: string;

  @ApiProperty({ description: 'LinkedIn URL', required: false })
  @IsOptional()
  @IsString()
  linkedin?: string;
}

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', required: true })
  @IsString()
  companyName: string;

  @ApiProperty({ description: 'Company description', required: true })
  @IsOptional()
  @IsString()
  companyDescription?: string;

  @ApiProperty({ description: 'Company email', required: false })
  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @ApiProperty({ description: 'Company phone number', required: false })
  @IsOptional()
  @IsString()
  companyPhoneNumber?: string;

  @ApiProperty({ description: 'Company address', required: false })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiProperty({
    description: 'Array of links to company images',
    type: 'array',
    items: {
      type: 'string',
    },
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyImages?: string[];

  @ApiProperty({ description: 'Company website', required: false })
  @IsOptional()
  @IsString()
  companyWebsite?: string;

  @ApiProperty({
    description: 'Company social media links',
    required: false,
    type: CompanySocialMediaDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CompanySocialMediaDto)
  companySocialMedia?: CompanySocialMediaDto;

  @ApiProperty({
    description: 'Subcategories (ServiceCategory IDs)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  subcategories?: string[];

  @ApiProperty({ description: 'ZIP code', required: false })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'Latitude', required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ description: 'Longitude', required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ description: 'Owner ID', required: true })
  @IsMongoId()
  owner: string;

  @ApiProperty({
    description: 'Selected services',
    type: [String],
    required: false,
  })
  @IsArray()
  selectedServices?: string[];

  @ApiProperty({ description: 'Client IDs', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  clients?: string[];

  @ApiProperty({ description: 'Service IDs', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  services?: string[];
}
