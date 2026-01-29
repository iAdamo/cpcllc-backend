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
  UseGuards,
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
  UserPreference,
} from '../interfaces/preference.interface';
import { UserPreference as UserPreferenceDoc } from '@notification/schemas/user-preference.schema';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
    phoneNumber?: string;
  };
}

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
    @Req() req: RequestWithUser,
    @Body() dto: CreateNotificationDto,
  ): Promise<NotificationResponse> {
    return this.notificationService.create({
      ...dto,
      userId: req.user.userId,
    });
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create bulk notifications' })
  @ApiResponse({ status: 201 })
  async createBulk(
    @Req() req: RequestWithUser,

    @Body() dto: CreateBulkNotificationDto,
  ): Promise<{ success: number; failed: number }> {
    return this.notificationService.createBulk(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, type: [Notification] })
  async findAll(
    @Req() req: RequestWithUser,

    @Query() filter: FilterNotificationsDto,
  ): Promise<NotificationResponse[]> {
    return this.notificationService.findByUser({
      ...filter,
      userId: req.user.userId,
    });
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200 })
  async getUnreadCount(
    @Req() req: RequestWithUser,

    @Query('tenantId') tenantId?: string,
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadCount(
      req.user.userId,
      tenantId,
    );
    return { count };
  }

  @Put('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notifications as read' })
  async markAsRead(
    @Req() req: RequestWithUser,

    @Body('notificationIds') notificationIds: string[],
  ): Promise<void> {
    await this.notificationService.markAsRead(req.user.userId, notificationIds);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, type: UserPreferenceDoc })
  async getPreferences(@Req() req: RequestWithUser): Promise<UserPreference> {
    return this.preferenceService.getOrCreate(req.user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200, type: UserPreferenceDoc })
  async updatePreferences(
    @Req() req: RequestWithUser,
    @Body() dto: UpdatePreferenceDto,
  ): Promise<UserPreference> {
    return this.preferenceService.update(req.user.userId, dto);
  }

  @Put('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update push notification token' })
  async updatePushToken(
    @Req() req: RequestWithUser,

    @Body() dto: UpdatePushTokenDto,
  ): Promise<void> {
    await this.preferenceService.updatePushToken(req.user.userId, dto);
  }

  @Delete('push-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove push notification token' })
  async removePushToken(
    @Req() req: RequestWithUser,

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
    @Query('count') count: number = 100,
  ): Promise<{ retried: number }> {
    const retried = await this.queueService.retryFailedJobs(queueName, count);
    return { retried };
  }

  @Post('queues/:queueName/cleanup')
  @ApiOperation({ summary: 'Clean up stalled jobs in a queue' })
  async cleanupStalledJobs(
    @Param('queueName') queueName: string,
  ): Promise<{ cleaned: number }> {
    const cleaned = await this.queueService.cleanupStalledJobs();
    return { cleaned };
  }

  @Get('health')
  @ApiOperation({ summary: 'Notification system health check' })
  async healthCheck() {
    const [queueStats, redisInfo] = await Promise.all([
      this.queueService.getQueueMetrics(),
      this.queueService.getRedisInfo(),
    ]);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      queues: queueStats,
      redis: redisInfo,
    };
  }
}
