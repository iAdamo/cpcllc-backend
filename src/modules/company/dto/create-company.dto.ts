import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsArray,
  IsMongoId,
  ValidateNested,
  IsObject,
  IsUrl,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompanySocialMediaDto {
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

  @ApiProperty({ description: 'Other social media URL', required: false })
  @IsOptional()
  @IsString()
  other?: string;
}

class LocationCoordinatesDto {
  @ApiProperty({ description: 'Latitude', required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ description: 'Longitude', required: false })
  @IsOptional()
  @IsNumber()
  long?: number;
}

class LocationAddressDto {
  @ApiProperty({ description: 'ZIP code', required: false })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsOptional()
  @IsString()
  address?: string;
}

class LocationDto {
  @ApiProperty({ description: 'Coordinates', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationCoordinatesDto)
  coordinates?: LocationCoordinatesDto;

  @ApiProperty({ description: 'Address', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationAddressDto)
  address?: LocationAddressDto;
}

class CompanyLocationDto {
  @ApiProperty({ description: 'Primary location', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  primary?: LocationDto;

  @ApiProperty({ description: 'Secondary location', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  secondary?: LocationDto;

  @ApiProperty({ description: 'Tertiary location', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  tertiary?: LocationDto;
}

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', required: true })
  @IsString()
  companyName: string;

  @ApiProperty({ description: 'Company description', required: false })
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

  @ApiProperty({
    description: 'Array of company image URLs',
    type: [String],
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

  @IsOptional()
  @IsObject()
  @IsUrl()
  companySocialMedia?: Record<string, string>;

  @ApiProperty({
    description: 'Subcategories (array of IDs)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  subcategories?: string[];

  @ApiProperty({
    description: 'Company location',
    type: CompanyLocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyLocationDto)
  location: CompanyLocationDto;

  @ApiProperty({ description: 'Owner ID', required: true })
  @IsMongoId()
  owner: string;

  @ApiProperty({
    description: 'Array of client IDs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  clients?: string[];

  @ApiProperty({
    description: 'Array of user IDs who favorited the company',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  favoritedBy?: string[];

  @ApiProperty({
    description: 'Array of review IDs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  reviews?: string[];
}
