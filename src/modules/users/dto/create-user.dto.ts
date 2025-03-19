import { IsEmail, IsNotEmpty, IsOptional, IsString, IsEnum, IsBoolean, IsArray, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: "John", required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: "Doe", required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd' })
  @IsString()
  @IsNotEmpty()
  password: string;

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

  @ApiProperty({ default: false })
  @IsBoolean()
  verified: boolean;

  @ApiProperty({ default: false })
  @IsBoolean()
  forgetPassword: boolean;

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

  @ApiProperty({ enum: ['Client', 'Company', 'Admin'], default: 'Client' })
  @IsEnum(['Client', 'Company', 'Admin'])
  activeRole: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  activeRoleId?: string;
}
