import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  IsMongoId,
  IsArray,
} from 'class-validator';
import { CreateUserDto } from '@modules/dto/create-user.dto';

export class UpdateCompanyUserDto extends PartialType(CreateUserDto) {}
 