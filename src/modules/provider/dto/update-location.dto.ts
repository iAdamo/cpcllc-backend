import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class AddressDto {
  @ApiProperty({ description: 'Zip code of the location' })
  @IsString()
  @IsNotEmpty()
  zip: string;

  @ApiProperty({ description: 'City of the location' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State of the location' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Country of the location' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ description: 'Full address of the location' })
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class LocationDto {
  @ApiProperty({
    description: 'GeoJSON type',
    enum: ['Point'],
    default: 'Point',
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Coordinates [long, lat]', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: number[];

  @ApiProperty({ description: 'Address', required: false, type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class MediaDto {
  @ApiProperty({ description: 'Primary image URL', required: true })
  @IsString()
  @IsNotEmpty()
  primary: string;

  @ApiProperty({ description: 'Secondary image URL', required: false })
  @IsString()
  @IsOptional()
  secondary?: string;

  @ApiProperty({ description: 'Tertiary image URL', required: false })
  @IsString()
  @IsOptional()
  tertiary?: string;
}

export class MediaGroupDto {
  @ApiProperty({ description: 'Image media group' })
  @ValidateNested()
  @Type(() => MediaDto)
  image: MediaDto;

  @ApiProperty({ description: 'Video media group' })
  @ValidateNested()
  @Type(() => MediaDto)
  video: MediaDto;
}
