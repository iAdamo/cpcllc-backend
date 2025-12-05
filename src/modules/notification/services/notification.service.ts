import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import {
  NotificationChannel,
  NotificationCategory,
  NotificationStatus,
  NotificationPriority,
  CreateNotificationDto,
  CreateBulkNotificationDto,
  UpdateNotificationDto,
  FilterNotificationsDto,
  NotificationResponse,
} from '../interfaces/notification.interface';
import { Notification as NotificationDocument } from '../schemas/notification.schema';
import { PreferenceService } from './preference.service';
import { DeliveryService } from './delivery.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  constructor(
    @InjectModel(NotificationDocument.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectQueue('notification.delivery')
    private readonly deliveryQueue: Queue,
    @InjectQueue('notification.scheduled')
    private readonly scheduledQueue: Queue,
    private readonly preferenceService: PreferenceService,
    private readonly deliveryService: DeliveryService,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationResponse> {
    // Check user preferences
    const canSend = await this.preferenceService.canSendNotification(
      dto.userId,
      dto.category,
    );

    if (!canSend.canSend) {
      throw new Error(`Cannot send notification: ${canSend.reason}`);
    }

    // Determine channels based on preferences
    const channels = await this.determineChannels(
      dto,
      canSend.preferredChannels,
    );

    // Create notification record
    const notification = await this.notificationModel.create({
      userId: dto.userId,
      tenantId: dto.tenantId,
      title: dto.title,
      body: dto.body,
      category: dto.category,
      priority: dto.priority || NotificationPriority.NORMAL,
      status: NotificationStatus.PENDING,
      actionUrl: dto.actionUrl,
      actionType: dto.actionType,
      metadata: dto.metadata,
      channels,
      deliveries: channels.map((channel) => ({
        channel,
        status: 'PENDING',
        retryCount: 0,
      })),
      expiresAt: dto.expiresAt,
      scheduledAt: dto.scheduledAt,
    });

    // Queue for delivery
    if (dto.scheduledAt && dto.scheduledAt > new Date()) {
      await this.scheduleNotification(notification);
    } else {
      await this.queueNotificationDelivery(notification);
    }

    this.logger.log(
      `Created notification: ${notification.id} for user: ${dto.userId}`,
    );
    return this.toResponse(notification);
  }

  async createBulk(
    dto: CreateBulkNotificationDto,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const userId of dto.userIds) {
      try {
        await this.create({
          ...dto,
          userId,
        });
        success++;
      } catch (error) {
        this.logger.error(
          `Failed to create notification for user ${userId}:`,
          error,
        );
        failed++;
      }
    }

    this.logger.log(
      `Bulk notification completed: ${success} success, ${failed} failed`,
    );
    return { success, failed };
  }

  async findById(id: string): Promise<NotificationResponse | null> {
    const notification = await this.notificationModel.findById(id);
    return notification ? this.toResponse(notification) : null;
  }

  async findByUser(
    dto: FilterNotificationsDto,
  ): Promise<NotificationResponse[]> {
    const query: any = { userId: dto.userId };

    if (dto.tenantId) query.tenantId = dto.tenantId;
    if (dto.categories?.length) query.category = { $in: dto.categories };
    if (dto.statuses?.length) query.status = { $in: dto.statuses };
    if (dto.channels?.length) query.channels = { $in: dto.channels };
    if (dto.priority) query.priority = dto.priority;
    if (dto.unreadOnly) query.readAt = { $exists: false };

    if (dto.startDate || dto.endDate) {
      query.createdAt = {};
      if (dto.startDate) query.createdAt.$gte = dto.startDate;
      if (dto.endDate) query.createdAt.$lte = dto.endDate;
    }

    const notifications = await this.notificationModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(dto.offset || 0)
      .limit(Math.min(dto.limit || 50, 100))
      .exec();

    return notifications.map((notification) => this.toResponse(notification));
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    await this.notificationModel.updateMany(
      {
        _id: { $in: notificationIds },
        userId,
      },
      {
        $set: {
          readAt: new Date(),
          status: NotificationStatus.READ,
          updatedAt: new Date(),
        },
      },
    );

    this.logger.log(
      `Marked ${notificationIds.length} notifications as read for user: ${userId}`,
    );
  }

  async updateStatus(
    notificationId: string,
    channel: NotificationChannel,
    status: 'SENT' | 'DELIVERED' | 'FAILED',
    error?: string,
  ): Promise<void> {
    const update: any = {
      'deliveries.$.status': status,
      'deliveries.$.updatedAt': new Date(),
    };

    if (status === 'SENT') {
      update['deliveries.$.sentAt'] = new Date();
    } else if (status === 'DELIVERED') {
      update['deliveries.$.deliveredAt'] = new Date();
    } else if (status === 'FAILED') {
      update['deliveries.$.error'] = error;
    }

    await this.notificationModel.updateOne(
      { _id: notificationId, 'deliveries.channel': channel },
      { $set: update },
    );

    // Update overall notification status
    await this.updateOverallStatus(notificationId);
  }

  async getUnreadCount(userId: string, tenantId?: string): Promise<number> {
    const query: any = {
      userId,
      readAt: { $exists: false },
      status: { $ne: NotificationStatus.ARCHIVED },
    };

    if (tenantId) query.tenantId = tenantId;

    return this.notificationModel.countDocuments(query);
  }

  private async determineChannels(
    dto: CreateNotificationDto,
    preferredChannels: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    let channels = dto.channels || [NotificationChannel.IN_APP];

    // Filter by user preferences
    channels = channels.filter((channel) =>
      preferredChannels.includes(channel),
    );

    // Always include IN_APP for high priority
    if (
      dto.priority === NotificationPriority.HIGH ||
      dto.priority === NotificationPriority.URGENT
    ) {
      if (!channels.includes(NotificationChannel.IN_APP)) {
        channels.push(NotificationChannel.IN_APP);
      }
    }

    return channels.length > 0 ? channels : [NotificationChannel.IN_APP];
  }

  async queueNotificationDelivery(
    notification: NotificationDocument,
  ): Promise<void> {
    await this.deliveryService.queueNotificationDelivery(
      notification['_id'],
      notification.userId.toString(),
      notification.tenantId,
      notification.title,
      notification.body,
      notification.category,
      notification.priority,
      notification.channels as NotificationChannel[],
      notification.metadata,
    );

    // Update status to PROCESSING
    await this.notificationModel.findByIdAndUpdate(notification['_id'], {
      status: NotificationStatus.PROCESSING,
      updatedAt: new Date(),
    });
  }

  private async scheduleNotification(
    notification: NotificationDocument,
  ): Promise<void> {
    const delay = notification.scheduledAt.getTime() - Date.now();

    await this.scheduledQueue.add(
      `scheduled:${notification['_id']}`,
      { notificationId: notification['_id'] },
      {
        jobId: `scheduled_${notification['_id']}`,
        delay,
        attempts: 1,
        removeOnComplete: true,
      },
    );
  }

  private async updateOverallStatus(notificationId: string): Promise<void> {
    const notification = await this.notificationModel.findById(notificationId);

    if (!notification) return;

    const deliveries = notification.deliveries;
    const allFailed = deliveries.every((d) => d.status === 'FAILED');
    const anySent = deliveries.some(
      (d) => d.status === 'SENT' || d.status === 'DELIVERED',
    );
    const allPending = deliveries.every((d) => d.status === 'PENDING');

    let newStatus = notification.status;

    if (allFailed) {
      newStatus = NotificationStatus.FAILED;
    } else if (anySent) {
      newStatus = NotificationStatus.SENT;
    } else if (!allPending) {
      newStatus = NotificationStatus.PROCESSING;
    }

    if (newStatus !== notification.status) {
      await this.notificationModel.findByIdAndUpdate(notificationId, {
        status: newStatus,
        updatedAt: new Date(),
      });
    }
  }

  private toResponse(notification: NotificationDocument): NotificationResponse {
    return {
      id: notification['_id'],
      userId: notification.userId.toString(),
      tenantId: notification.tenantId,
      title: notification.title,
      body: notification.body,
      category: notification.category as NotificationCategory,
      priority: notification.priority as NotificationPriority,
      status: notification.status as NotificationStatus,
      actionUrl: notification.actionUrl,
      actionType: notification.actionType,
      metadata: notification.metadata,
      channels: notification.channels as NotificationChannel[],
      deliveries: notification.deliveries.map((d) => ({
        channel: d.channel as NotificationChannel,
        status: d.status as any,
        messageId: d.messageId,
        error: d.error,
        sentAt: d.sentAt,
        deliveredAt: d.deliveredAt,
        retryCount: d.retryCount,
      })),
      readAt: notification.readAt,
      expiresAt: notification.expiresAt,
      scheduledAt: notification.scheduledAt,
      createdAt: notification['createdAt'],
      updatedAt: notification['updatedAt'],
    };
  }
}
