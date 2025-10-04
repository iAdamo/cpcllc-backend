import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

class CoordinatesDto {
  @ApiProperty({ example: '28.0455755' })
  @IsString()
  @IsOptional()
  lat?: string;

  @ApiProperty({ example: '-82.737696' })
  @IsString()
  @IsOptional()
  long?: string;
}

class AddressDto {
  @ApiProperty({ example: '30109 US Hwy 19 N, Clearwater, FL 33761' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'Clearwater' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Florida' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ example: 'United States' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: '33761' })
  @IsString()
  @IsOptional()
  zip?: string;
}

class LocationDto {
  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;
}

export class CreateProviderDto {
  @ApiProperty({ example: 'Kajola Industries' })
  @IsString()
  @IsNotEmpty()
  providerName: string;

  @ApiProperty({ example: 'Upload up to 6 professional company images...' })
  @IsString()
  @IsOptional()
  providerDescription?: string;

  @ApiProperty({ example: 'wayoffire909@gmail.com' })
  @IsEmail()
  @IsOptional()
  providerEmail?: string;

  @ApiProperty({ example: '13446657575' })
  @IsString()
  @IsOptional()
  providerPhoneNumber?: string;

  @ApiProperty({ example: ['68ced077417a7e10d45e146d'] })
  @IsArray()
  @IsNotEmpty()
  categories?: (string | Types.ObjectId)[];

  @ApiProperty({ example: ['68ced077417a7e10d45e147d'] })
  @IsArray()
  @IsOptional()
  subcategories?: (string | Types.ObjectId)[];

  @IsOptional()
  @IsObject()
  @IsUrl()
  providerSocialMedia?: Record<string, string>;

  @ApiProperty()
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: {
    primary?: LocationDto;
    secondary?: LocationDto;
    tertiary?: LocationDto;
  };

  @ApiProperty({ example: 'Provider' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ example: 'US Highway 19 North' })
  @IsString()
  @IsOptional()
  street?: string;
}
