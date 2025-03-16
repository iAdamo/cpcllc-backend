import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';
import { CreateUsersDto } from '@dto/create-users.dto';

export class UpdateCompanyUserDto extends PartialType(CreateUsersDto) {
  @ApiProperty({ description: 'Company name', required: false })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ description: 'Company description', required: false })
  @IsString()
  @IsOptional()
  companyDescription?: string;

  @ApiProperty({ description: 'Company email', required: false })
  @IsEmail()
  @IsOptional()
  companyEmail?: string;

  @ApiProperty({ description: 'Company phone number', required: false })
  @IsString()
  @IsOptional()
  companyPhoneNumber?: string;

  @ApiProperty({ description: 'Company address', required: false })
  @IsString()
  @IsOptional()
  companyAddress?: string;

  @ApiProperty({ description: 'Company logo', type: 'string', format: 'binary', required: false })
  @IsOptional()
  companyLogo?: File | null;

  @ApiProperty({ description: 'ZIP code', required: false })
  @IsString()
  @IsOptional()
  zip?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'Latitude', required: false })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ description: 'Longitude', required: false })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ description: 'State', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsString()
  @IsOptional()
  country?: string;
}
