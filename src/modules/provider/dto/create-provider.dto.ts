import {
  IsEmail,
  IsNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

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

export class LocationDto {
  @IsOptional()
  @IsEnum(['Point'])
  type?: 'Point' = 'Point';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  coordinates: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class LocationContainerDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  primary?: LocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  secondary?: LocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  tertiary?: LocationDto;
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
  providerSocialMedia?: Record<string, string>;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationContainerDto)
  location?: LocationContainerDto;

  @ApiProperty({ example: 'Provider' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ example: 'US Highway 19 North' })
  @IsString()
  @IsOptional()
  street?: string;

  @ApiProperty({ example: true })
  @IsOptional()
  isLiveTrackable?: boolean;
}
