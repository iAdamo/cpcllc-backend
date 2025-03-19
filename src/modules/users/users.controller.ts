import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from '@services/users.service';
import { CreateUserDto } from '@modules/dto/create-user.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateCompanyUserDto } from '@dto/update-company.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'companyLogo', maxCount: 1 },
    ]),
  )
  async createUsers(
    @Body() userDto: CreateUserDto | CreateCompanyDto | CreateAdminDto,
    @Param('id') id?: string,
    files?: {
      profilePicture?: Express.Multer.File[];
      companyLogo?: Express.Multer.File[];
    },
  ) {
    if (!id) {
      return this.usersService.createUsers(userDto as CreateUserDto);
    } else if ('companyName' in userDto) {
      return this.usersService.createCompany(
        id,
        userDto as CreateCompanyDto,
        files.companyLogo,
      );
    } else {
      return this.usersService.createAdmin(id, userDto as CreateAdminDto);
    }
  }
}
