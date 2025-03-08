import { IsEmail, IsNotEmpty, IsString, Matches, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  Admin = 'Admin',
  Client = 'Client',
  Company = 'Company',
}

export class CreateUsersDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/, {
    message: 'Password too weak',
  })
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.Client })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
