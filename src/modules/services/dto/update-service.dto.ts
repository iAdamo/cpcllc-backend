import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
