import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateJobDto {
  @ApiProperty({ description: 'Subcategory ID for the job', required: true })
  @IsMongoId()
  subcategoryId: string;

  @ApiProperty({ description: 'Job title', required: true })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Job description', required: true })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Budget for the job', required: true })
  @IsNumber()
  budget: number;

  @ApiProperty({ description: 'Is budget negotiable', required: false })
  @IsOptional()
  @IsBoolean()
  negotiable?: boolean;

  @ApiProperty({ description: 'Deadline ISO string', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ description: 'Location text', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: 'GeoJSON coordinates [long, lat]',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates?: number[];

  @ApiProperty({
    description: "Urgency: 'normal'|'urgent'|'immediate'",
    required: false,
  })
  @IsOptional()
  @IsIn(['normal', 'urgent', 'immediate'])
  urgency?: string;

  @ApiProperty({
    description: "Visibility: 'public'|'verified_only'",
    required: false,
  })
  @IsOptional()
  @IsIn(['public', 'verified_only'])
  visibility?: string;

  @ApiProperty({
    description: "Contact preference: 'chat'|'call'|'both' (array)",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsIn(['chat', 'call', 'both'], { each: true })
  contactPreference?: string[];

  @ApiProperty({ description: 'Tags', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Anonymous posting flag', required: false })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}
