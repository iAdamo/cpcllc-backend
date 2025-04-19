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
import { LocationDto, MediaGroupDto } from '@dto/create-location.dto';

export class CreateServiceDto {
  @ApiProperty({ description: 'The title of the service' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'The description of the service' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'The price of the service' })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({ description: 'The category of the service' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'The ratings of the service', required: false })
  @IsNumber()
  @IsOptional()
  ratings?: number;

  @ApiProperty({ description: 'The location of the service', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    description: 'The media details of the service',
    type: MediaGroupDto,
  })
  @ValidateNested()
  @Type(() => MediaGroupDto)
  media: MediaGroupDto;

  @ApiProperty({
    description: 'The ID of the company providing the service',
    type: String,
  })
  @IsNotEmpty()
  company: Types.ObjectId;

  @ApiProperty({
    description: 'The list of client IDs associated with the service',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsOptional()
  clients?: Types.ObjectId[];
}
