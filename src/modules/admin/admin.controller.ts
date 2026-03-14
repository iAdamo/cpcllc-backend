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
import { AdminMetricService } from './service/metrics.service';
import { CacheService } from '@cache/cache.service';
import { MetricsRequest, MetricsResponse } from '@types';

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
  constructor(
    private readonly adminService: AdminService,
    private readonly metricService: AdminMetricService,
    private readonly cacheService: CacheService,
  ) {}

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

  // Metrics endpoint
  // metrics service getMetrics
  @Get('metrics')
  async getMetrics(@Query() query: MetricsRequest): Promise<MetricsResponse> {
    const cacheKey = `metrics:${JSON.stringify(query)}`;
    const cached = await this.cacheService.get<MetricsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.metricService.getMetrics(query);
    await this.cacheService.set(cacheKey, result, 300); // Cache for 5 minutes

    return result;
  }
}
