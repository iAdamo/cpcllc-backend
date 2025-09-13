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
import { Types } from 'mongoose';

class CoordinatesDto {
  @ApiProperty({ description: 'Latitude', required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ description: 'Longitude', required: false })
  @IsOptional()
  @IsNumber()
  long?: number;
}

class AddressDto {
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
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  @ApiProperty({ description: 'Address', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

export class UpdateProviderDto {
  @ApiProperty({ description: 'Provider name', required: true })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiProperty({ description: 'Provider description', required: true })
  @IsOptional()
  @IsString()
  providerDescription?: string;

  @ApiProperty({ description: 'Provider email', required: true })
  @IsOptional()
  @IsEmail()
  providerEmail?: string;

  @ApiProperty({ description: 'Provider phone number', required: true })
  @IsOptional()
  @IsString()
  providerPhoneNumber?: string;

  @ApiProperty({ description: 'Provider logo URL', required: false })
  @IsOptional()
  @IsString()
  providerLogo?: string;

  @ApiProperty({
    description: 'Array of provider image URLs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providerImagesUrl?: string[];

  @IsOptional()
  @IsObject()
  @IsUrl()
  providerSocialMedia?: Record<string, string>;

  @ApiProperty({
    description: 'Categories (array of IDs)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  categories?: Types.ObjectId[] | string[];

  @ApiProperty({
    description: 'Subcategories (array of IDs)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  subcategories?: Types.ObjectId[] | string[];

  @ApiProperty({
    description: 'Provider location',
    type: LocationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: {
    primary?: LocationDto;
    secondary?: LocationDto;
    tertiary?: LocationDto;
  };

  @ApiProperty({ description: 'Owner ID', required: true })
  @IsOptional()
  @IsMongoId()
  owner?: Types.ObjectId;

  @ApiProperty({
    description: 'Array of client IDs',
    type: [Types.ObjectId],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  clients?: Types.ObjectId[];

  @ApiProperty({
    description: 'Array of user IDs who favorited the provider',
    type: [Types.ObjectId],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  favoritedBy?: Types.ObjectId[];

  @ApiProperty({
    description: 'Array of review IDs',
    type: [Types.ObjectId],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  reviews?: Types.ObjectId[];
}
