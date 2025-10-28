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
// import { CreateProviderDto } from '../provider/dto/update-provider.dto';
import { CreateAdminDto } from '@dto/create-admin.dto';
import { UpdateUserDto } from '@modules/dto/update-user.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, ProfileViewOnceGuard } from '@guards/jwt.guard';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
    phoneNumber?: string;
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

  @Patch('profile')
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

  @UseGuards(JwtAuthGuard, ProfileViewOnceGuard)
  @Get('profile/:id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.userProfile(id);
  }

  @Patch('follow/:providerId')
  @UseGuards(JwtAuthGuard)
  async followProvider(
    @Param('providerId') providerId: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    return this.usersService.toggleFollowProvider(userId, providerId);
  }

  /**
   * Delete files by their URLs
   * @param fileUrls Array of file URLs to delete
   * @returns Deletion result
   **/
  @Post('delete-files')
  @UseGuards(JwtAuthGuard)
  async deleteFiles(
    @Body('fileUrls') fileUrls: string[],
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.userId;
    return this.usersService.removeMediaFiles(userId, fileUrls);
  }
}
