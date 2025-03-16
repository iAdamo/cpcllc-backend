import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsNumber } from 'class-validator';
import { CreateUsersDto } from '@dto/create-users.dto';

export class UpdateClientUserDto extends PartialType(CreateUsersDto) {
  @ApiProperty({ description: 'Client name', required: false })
  @IsString()
  @IsOptional()
  clientName?: string;

  @ApiProperty({ description: 'Client description', required: false })
  @IsString()
  @IsOptional()
  clientDescription?: string;

  @ApiProperty({ description: 'Client email', required: false })
  @IsEmail()
  @IsOptional()
  clientEmail?: string;

  @ApiProperty({ description: 'Client phone number', required: false })
  @IsString()
  @IsOptional()
  clientPhoneNumber?: string;

  @ApiProperty({ description: 'Client address', required: false })
  @IsString()
  @IsOptional()
  clientAddress?: string;

  @ApiProperty({
    description: 'Client logo',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  clientLogo?: File | null;

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
}
