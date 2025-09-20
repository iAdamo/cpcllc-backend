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
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { LocationDto } from './update-location.dto';

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
  categories: (string | Types.ObjectId)[];

  @ApiProperty({
    description: 'Subcategories (array of IDs)',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  subcategories: (string | Types.ObjectId)[];

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
