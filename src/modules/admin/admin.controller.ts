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
import { AdminService } from '@services/admin.service';
import { AdminGuard } from '@modules/jwt/jwt.guard';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('profile')
  @UseGuards(AdminGuard)
  async getAdminProfile(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.adminService.getAdminById(userId);
  }
}
