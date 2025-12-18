import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({ description: 'The description of the review' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'The rating of the review',
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'The tags of the review', required: false })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({ description: 'The service ID' })
  @IsMongoId()
  @IsOptional()
  service?: Types.ObjectId;
}
