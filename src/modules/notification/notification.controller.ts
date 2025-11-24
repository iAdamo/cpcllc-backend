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
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '@modules/jwt/jwt.guard';
import { BadRequestException } from '@nestjs/common';
import { Presence, PresenceDocument } from '@schemas/presence.schema';
import { NotificationService } from './notification.service';
import { UpdateAvailabilityDto } from './dto/update-presence.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PreferencesService } from './preferences.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    phoneNumber: string;
    userId: string;
  };
}

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferencesService: PreferencesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({
    status: 202,
    description: 'Notification accepted for processing',
    type: NotificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async sendNotification(
    @Body() createDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.sendNotification(createDto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of user notifications',
    type: [NotificationResponseDto],
  })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ): Promise<NotificationResponseDto[]> {
    return this.notificationService.getUserNotifications(userId, limit, offset);
  }

  @Patch('user/:userId/read/:notificationId')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: NotificationResponseDto,
  })
  async markAsRead(
    @Param('userId') userId: string,
    @Param('notificationId') notificationId: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationService.markAsRead(notificationId, userId);
  }

  @Get('user/:userId/unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiResponse({
    status: 200,
    description: 'Unread notifications count',
    type: Number,
  })
  async getUnreadCount(@Param('userId') userId: string): Promise<number> {
    return this.notificationService.getUnreadCount(userId);
  }

  @Get('preferences/:userId')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, description: 'User preferences' })
  async getPreferences(@Param('userId') userId: string) {
    return this.preferencesService.getUserPreferences(userId);
  }

  @Patch('preferences/:userId')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  async updatePreferences(
    @Param('userId') userId: string,
    @Body() updateDto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.updateUserPreferences(userId, updateDto);
  }

  @Get('presence/:userId')
  async getLastSeen(@Param('userId') userId: string) {
    return await this.notificationService.getPresence(userId);
  }

  @Post('presence/status')
  async updateAvailability(
    @Req() req: RequestWithUser,
    @Body() body: UpdateAvailabilityDto,
  ) {
    const userId = req.user.userId;
    const updated = await this.notificationService.updateAvailability(
      userId,
      body.status,
    );

    return updated;
  }
}
