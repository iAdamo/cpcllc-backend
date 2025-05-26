import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@schemas/user.schema';
import { UsersService } from '@services/users.service';
import { CreateUserDto } from '@modules/dto/create-user.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateCompanyUserDto } from '@dto/update-company.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Company } from '@schemas/company.schema';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id?')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'companyImages', maxCount: 10 },
    ]),
  )
  async createUsers(
    @Body() userDto: CreateUserDto | CreateCompanyDto | CreateAdminDto,
    @Param('id') id?: string,
    @UploadedFiles()
    files?: {
      profilePicture?: Express.Multer.File[];
      companyImages?: Express.Multer.File[];
    },
  ) {
    if (!id) {
      return this.usersService.createUsers(userDto as CreateUserDto);
    } else if ('companyName' in userDto) {
      return this.usersService.createCompany(
        id,
        userDto as CreateCompanyDto,
        files,
      );
    } else {
      return this.usersService.createAdmin(id, userDto as CreateAdminDto);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.userProfile(id);
  }

  /**
   * Get all companies with pagination
   * @param page Page number
   * @param limit Number of companies per page
   * @returns List of companies and total pages
   */
  @Get('company')
  async getAllCompanies(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.usersService.getAllCompanies(page, limit);
  }

  /**
   * Get all users with pagination
   * @param page Page number
   * @param limit Number of users per page
   * @returns List of users and total pages
   */
  @Get()
  async getAllUsers(
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.usersService.getAllUsers(page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/favorite')
  async toggleFavorite(
    @Param('id') companyId: string,
    @Req() req: RequestWithUser,
  ): Promise<Company> {
    return this.usersService.toggleFavorite(companyId, req.user.userId);
  }
}
