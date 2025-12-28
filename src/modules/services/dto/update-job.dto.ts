import { Types } from 'mongoose';
import { PartialType } from '@nestjs/mapped-types';
import { CreateJobDto } from './create-job.dto';
import { IsOptional, IsBoolean, IsEnum, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum JobStatus {
  Active = 'Active',
  In_progress = 'In_progress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  Expired = 'Expired',
}

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @IsOptional()
  // @IsBoolean()
  // @Type(() => Boolean)
  isActive?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsArray()
  @Type(() => Types.ObjectId)
  proposals?: Types.ObjectId[];
}
