import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsBoolean, IsArray, IsMongoId, IsEnum } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ example: "John", required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: "Doe", required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'user@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'StrongP@ssw0rd', required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ example: 'https://example.com/profile.jpg', required: false })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiProperty({ example: '123456', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  codeAt?: Date;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  forgetPassword?: boolean;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  purchasedServices?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  hiredCompanies?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  admins?: string[];

  @ApiProperty({ enum: ['Client', 'Company', 'Admin'], default: 'Client', required: false })
  @IsOptional()
  @IsEnum(['Client', 'Company', 'Admin'])
  activeRole?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  activeRoleId?: string;
}
