import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Presence, PresenceDocument } from '@schemas/presence.schema';
import { Notification } from './schemas/notification.schema';
import { UserPreference } from './schemas/user-preference.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import {
  NotificationPayload,
  NotificationChannel,
  NotificationCategory,
  DeliveryJobData,
} from './interfaces/notification.interface';
import { PreferencesService } from './preferences.service';
import { InAppAdapter } from './adapters/inapp.adapter';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Presence.name) private presenceModel: Model<PresenceDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @InjectModel(UserPreference.name)
    private readonly userPreferenceModel: Model<UserPreference>,
    @InjectQueue('notification-delivery')
    private readonly deliveryQueue: Queue<DeliveryJobData>,
    private readonly preferencesService: PreferencesService,
    private readonly inAppAdapter: InAppAdapter,
  ) {}

  async sendNotification(
    createDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    this.logger.log(`Sending notification to user ${createDto.userId}`);

    // Get user preferences
    const preferences = await this.preferencesService.getUserPreferences(
      createDto.userId,
    );

    // Filter channels based on preferences
    const allowedChannels = await this.filterChannelsByPreferences(
      createDto.userId,
      createDto.category,
      createDto.channels || Object.values(NotificationChannel),
    );

    if (allowedChannels.length === 0) {
      this.logger.warn(
        `No allowed channels for user ${createDto.userId} and category ${createDto.category}`,
      );
      throw new Error('No allowed notification channels for user');
    }

    // Create notification payload
    const payload: NotificationPayload = {
      userId: createDto.userId,
      tenantId: createDto.tenantId,
      title: createDto.title,
      body: createDto.body,
      category: createDto.category,
      actionUrl: createDto.actionUrl,
      actionType: createDto.actionType,
      meta: createDto.meta,
      channels: allowedChannels,
      expiresAt: createDto.expiresAt,
    };

    // Save in-app notification immediately
    if (allowedChannels.includes(NotificationChannel.IN_APP)) {
      await this.saveInAppNotification(payload);
    }

    // Queue delivery for other channels
    await this.queueDelivery(payload, preferences);

    // Return the created notification
    const notification = await this.notificationModel
      .findOne({
        userId: createDto.userId,
        title: createDto.title,
        body: createDto.body,
      })
      .sort({ createdAt: -1 });

    return this.mapToNotificationResponseDto(notification!);
  }

  async getUserNotifications(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();

    return notifications.map((notification) =>
      this.mapToNotificationResponseDto(notification),
    );
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { readAt: new Date() },
      { new: true },
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.mapToNotificationResponseDto(notification);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId,
      readAt: { $exists: false },
    });
  }

  private async filterChannelsByPreferences(
    userId: string,
    category: NotificationCategory,
    requestedChannels: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    const filteredChannels: NotificationChannel[] = [];

    for (const channel of requestedChannels) {
      // Check if channel is enabled
      const isEnabled = await this.preferencesService.isChannelEnabled(
        userId,
        channel,
      );
      if (!isEnabled) continue;

      // Check if category is muted
      const isMuted = await this.preferencesService.isCategoryMuted(
        userId,
        category,
      );
      if (isMuted) continue;

      // Check quiet hours (for push/email/sms)
      if (channel !== NotificationChannel.IN_APP) {
        const inQuietHours =
          await this.preferencesService.isInQuietHours(userId);
        if (inQuietHours) continue;
      }

      filteredChannels.push(channel);
    }

    return filteredChannels;
  }

  private async saveInAppNotification(
    payload: NotificationPayload,
  ): Promise<void> {
    await this.inAppAdapter.send(payload);
  }

  private async queueDelivery(
    payload: NotificationPayload,
    preferences: any,
  ): Promise<void> {
    const channelsToQueue = payload.channels.filter(
      (channel) => channel !== NotificationChannel.IN_APP,
    );

    for (const channel of channelsToQueue) {
      const jobData: DeliveryJobData = {
        notificationId: `${payload.userId}-${Date.now()}`,
        channel,
        payload,
      };

      const jobOptions = {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      };

      await this.deliveryQueue.add(channel, jobData, jobOptions);
      this.logger.debug(
        `Queued ${channel} delivery for user ${payload.userId}`,
      );
    }
  }

  private mapToNotificationResponseDto(
    notification: Notification,
  ): NotificationResponseDto {
    return {
      id: notification['_id'].toString(),
      userId: notification.userId.toString(),
      tenantId: notification.tenantId,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      actionUrl: notification.actionUrl,
      actionType: notification.actionType,
      meta: notification.meta,
      channels: notification.channels,
      status: notification.status,
      readAt: notification.readAt,
      deliveredAt: notification.deliveredAt,
      expiresAt: notification.expiresAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  async updateLastSeen(userId: string, lastSeen: Date) {
    await this.presenceModel.updateOne(
      { userId },
      { $set: { isOnline: false, lastSeen } },
      { upsert: true },
    );
  }

  async getPresence(userId: string): Promise<Presence> {
    return await this.presenceModel.findOne({ userId });
  }

  async updateAvailability(userId: string, status: string): Promise<Presence> {
    if (!userId) {
      throw new BadRequestException(
        'userId is required to update availability',
      );
    }

    const normalized = (status || '').trim().toLowerCase();

    // Allowed statuses
    const allowedStatuses = ['available', 'offline', 'busy', 'away'];
    if (!allowedStatuses.includes(normalized)) {
      throw new BadRequestException(`Invalid availability status: ${status}`);
    }

    // Online if NOT offline
    const isOnline = normalized !== 'offline';

    const update: any = {
      isOnline,
      availability: normalized, // store lowercase consistently
    };

    if (!isOnline) {
      update.lastSeen = new Date();
    }

    const updated = await this.presenceModel.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: true, lean: true },
    );

    return updated;
  }
}
