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
import { ProviderService } from 'src/modules/provider/provider.service';
import { CreateUserDto } from '@modules/dto/create-user.dto';
import { CreateProviderDto } from '../provider/dto/create-provider.dto';
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
    private readonly providerService: ProviderService,
    private readonly adminService: AdminService,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'profilePicture', maxCount: 1 }]),
  )
  async createUser(
    @Body()
    userDto: CreateUserDto,
  ) {
    return this.usersService.createUsers(userDto as CreateUserDto);
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

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async userProfile(@Req() req: RequestWithUser) {
    const id = req.user.userId;
    return this.usersService.userProfile(id);
  }

  @Get('profile/:id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.userProfile(id);
  }

  // @Post(':id?')
  // @UseInterceptors(
  //   FileFieldsInterceptor([
  //     { name: 'profilePicture', maxCount: 1 },
  //     { name: 'providerImages', maxCount: 10 },
  //   ]),
  // )
  // async createUsers(
  //   @Body()
  //   userDto: CreateUserDto | CreateProviderDto | CreateAdminDto,
  //   @Param('id') id?: string,
  //   @UploadedFiles()
  //   files?: {
  //     profilePicture?: Express.Multer.File[];
  //     providerImages?: Express.Multer.File[];
  //   },
  // ) {
  //   if (!id) {
  //     return this.usersService.createUsers(userDto as CreateUserDto);
  //   } else if ('providerName' in userDto) {
  //     return this.providerService.createProvider(
  //       id,
  //       userDto as CreateProviderDto,
  //       files,
  //     );
  //   } else {
  //     return this.adminService.createAdmin(id, userDto as CreateAdminDto);
  //   }
  // }
}
