import {
  Controller,
  Get,
  Post,
  Req,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { Notification } from '@notification/schemas/notification.schema';
import { NotificationService } from '@notification/services/notification.service';
import { PreferenceService } from '../services/preference.service';
import { TemplateService } from '../services/template.service';
import { QueueService } from '../queues/queue.service';

import {
  CreateNotificationDto,
  CreateBulkNotificationDto,
  FilterNotificationsDto,
  UpdateNotificationDto,
  NotificationResponse,
} from '../interfaces/notification.interface';

import {
  UpdatePreferenceDto,
  UpdatePushTokenDto,
} from '../interfaces/preference.interface';

import { UserPreference } from '@notification/schemas/user-preference.schema';

import { AuthUser } from '@websocket/interfaces/websocket.interface';

// export interface AuthUser extends Request {
//   user: {
//     email: string;
//     userId: string;
//     phoneNumber?: string;
//   };
// }

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: PreferenceService,
    private readonly templateService: TemplateService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  @ApiResponse({ status: 201, type: Notification })
  async create(
    @Req() req: AuthUser,
    @Body() dto: CreateNotificationDto,
  ): Promise<NotificationResponse> {
    return this.notificationService.create({
      ...dto,
      userId: req.user.userId,
    });
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create bulk notifications' })
  async createBulk(
    @Body() dto: CreateBulkNotificationDto,
  ): Promise<{ success: number; failed: number }> {
    return this.notificationService.createBulk(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, type: [Notification] })
  async findAll(
    @Req() req: AuthUser,
    @Query() filter: FilterNotificationsDto,
  ): Promise<NotificationResponse[]> {
    return this.notificationService.findByUser({
      ...filter,
      userId: req.user.userId,
    });
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(
    @Req() req: AuthUser,
    @Query('tenantId') tenantId?: string,
  ): Promise<{ count: number }> {
    return {
      count: await this.notificationService.getUnreadCount(
        req.user.userId,
        tenantId,
      ),
    };
  }

  @Put('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notifications as read' })
  async markAsRead(
    @Req() req: AuthUser,
    @Body('notificationIds') notificationIds: string[],
  ): Promise<void> {
    await this.notificationService.markAsRead(req.user.userId, notificationIds);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200 })
  async getPreferences(@Req() req: AuthUser): Promise<UserPreference> {
    return this.preferenceService.getOrCreate(req.user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200 })
  async updatePreferences(
    @Req() req: AuthUser,
    @Body() dto: UpdatePreferenceDto,
  ): Promise<UserPreference> {
    return this.preferenceService.update(req.user.userId, dto);
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Update push notification token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePushToken(
    @Req() req: AuthUser,
    @Body() dto: UpdatePushTokenDto,
  ): Promise<void> {
    await this.preferenceService.updatePushToken(req.user, dto);
  }

  @Post('push-token/disable')
  @ApiOperation({ summary: 'Disable push notification token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async disablePushToken(@Req() req: AuthUser): Promise<void> {
    await this.preferenceService.disablePushTokensForUserDevice(req.user);
  }

  @Delete('push-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove push notification token' })
  async removePushToken(
    @Req() req: AuthUser,
    @Param('token') token: string,
  ): Promise<void> {
    await this.preferenceService.removePushToken(req.user.userId, token);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all notification templates' })
  async getTemplates() {
    return this.templateService.getAllTemplates();
  }

  @Get('queues/stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  async getQueueStats() {
    return this.queueService.getQueueMetrics();
  }

  @Post('queues/:queueName/retry-failed')
  @ApiOperation({ summary: 'Retry failed jobs in a queue' })
  async retryFailedJobs(
    @Param('queueName') queueName: string,
    @Query('count') count = 100,
  ): Promise<{ retried: number }> {
    return {
      retried: await this.queueService.retryFailedJobs(queueName, count),
    };
  }

  @Post('queues/:queueName/cleanup')
  @ApiOperation({ summary: 'Clean up stalled jobs in a queue' })
  async cleanupStalledJobs(
    @Param('queueName') queueName: string,
  ): Promise<{ cleaned: number }> {
    return {
      cleaned: await this.queueService.cleanupStalledJobs(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Notification system health check' })
  async healthCheck() {
    const [queues, redis] = await Promise.all([
      this.queueService.getQueueMetrics(),
      this.queueService.getRedisInfo(),
    ]);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queues,
      redis,
    };
  }
}
