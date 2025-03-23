import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    description: 'The list of pictures associated with the service',
    type: [String],
    required: false,
  })
  @IsArray()
  @IsOptional()
  pictures?: string[];

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
