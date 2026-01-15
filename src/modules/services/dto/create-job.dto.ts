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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '@provider/dto/create-provider.dto';

export class CreateJobDto {
  @ApiProperty({ description: 'Provider ID for the job', required: false })
  @IsMongoId()
  @IsOptional()
  providerId?: string;

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
  @Type(() => Number)
  @IsNumber()
  budget: number;

  @ApiProperty({ description: 'Is budget negotiable', required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  negotiable?: boolean;

  @ApiProperty({ description: 'Deadline ISO string', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiProperty({
    description: "Urgency: 'normal'|'urgent'|'immediate'",
    required: false,
  })
  @IsOptional()
  @IsIn(['Normal', 'Urgent', 'Immediate'])
  urgency?: string;

  @ApiProperty({
    description: "Visibility: 'public'|'verified_only'",
    required: false,
  })
  @IsOptional()
  @IsIn(['Public', 'Verified_Only'])
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

  @ApiProperty({ description: 'Is the job active?', required: false })
  @IsOptional()
  // @IsBoolean()
  // @Type(() => Boolean)
  isActive?: string;
}
