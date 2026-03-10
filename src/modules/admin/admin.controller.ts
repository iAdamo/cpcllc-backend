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
import { Roles } from 'src/common/decorators/guard.decorator';
import { TimeRange } from '@services/admin.service';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Admin')
@Controller('admin')
// @Roles('Admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('profile')
  async getAdminProfile(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.adminService.getAdminById(userId);
  }

  // @Patch('profile')
  // @UseGuards(AdminGuard)
  // async updateAdminProfile(
  //   @Req() req: RequestWithUser,
  //   @Body() updateData: any,
  // ) {
  //   const userId = req.user.userId;
  //   return this.adminService.updateAdminProfile(userId, updateData);
  // }

  @Get('metrics')
  async getMetrics(@Query('range') range: string) {
    console.log(`Received request for metrics with range: ${range}`);
    // // Validate the range parameter
    // const validRanges: TimeRange[] = ['1d', '7d', '30d', '90d', '1y'];
    // if (!validRanges.includes(range as TimeRange)) {
    //   throw new Error(
    //     `Invalid range parameter. Valid values are: ${validRanges.join(', ')}`,
    //   );
    // }
    return this.adminService.getMetrics(range as TimeRange);
  }
}
