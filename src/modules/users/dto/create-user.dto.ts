import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ example: 'StrongP@ssw0rd' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'en', required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ example: false, default: false })
  @IsBoolean()
  isEmailVerified: boolean;

  @ApiProperty({ example: false, default: false })
  @IsBoolean()
  isPhoneVerified: boolean;

  @ApiProperty({ example: 0, default: 0 })
  @IsOptional()
  emailEditCount?: number;

  @ApiProperty({ example: 0, default: 0 })
  @IsOptional()
  phoneEditCount?: number;

  @ApiProperty({ example: true, default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  codeAt?: Date;

  @ApiProperty({ default: false })
  @IsBoolean()
  isVerified: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  forgetPassword: boolean;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  admins?: string[];

  @ApiProperty({ enum: ['Client', 'Provider', 'Admin'], default: 'Client' })
  @IsEnum(['Client', 'Provider', 'Admin'])
  activeRole: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  activeRoleId?: string;
}
