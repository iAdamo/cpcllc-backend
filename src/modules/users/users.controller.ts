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
import { UsersService } from '@modules/users.service';
import { AdminService } from '../admin/admin.service';
import { CompanyService } from '@services/company.service';
import { CreateUserDto } from '@modules/dto/create-user.dto';
import { CreateCompanyDto } from '../company/dto/create-company.dto';
import { CreateAdminDto } from '@dto/create-admin.dto';
import { UpdateUserDto } from '@modules/dto/update-user.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly companyService: CompanyService,
    private readonly adminService: AdminService,
  ) {}

  @Post(':id?')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePicture', maxCount: 1 },
      { name: 'companyImages', maxCount: 10 },
    ]),
  )
  async createUsers(
    @Body()
    userDto: CreateUserDto | CreateCompanyDto | CreateAdminDto,
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
      return this.companyService.createCompany(
        id,
        userDto as CreateCompanyDto,
        files,
      );
    } else {
      return this.adminService.createAdmin(id, userDto as CreateAdminDto);
    }
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'profilePicture', maxCount: 1 }]),
  )
  async updateUser(
    @Body() userDto: UpdateUserDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: {
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const id = req.user.userId;
    return this.usersService.updateUser(id, userDto, files?.profilePicture);
  }


  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.userProfile(id);
  }
}
