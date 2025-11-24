import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BaseAdapter,
  NotificationAdapter,
} from '../interfaces/adapter.interface';
import {
  NotificationPayload,
  NotificationStatus,
} from '../interfaces/notification.interface';
import { Notification } from '../schemas/notification.schema';

@Injectable()
export class InAppAdapter extends BaseAdapter implements NotificationAdapter {
  readonly channel = 'inapp';
  private readonly logger = new Logger(InAppAdapter.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {
    super();
  }

  async send(payload: NotificationPayload, options?: any): Promise<void> {
    this.validatePayload(payload);

    this.logger.log(`Creating in-app notification for user ${payload.userId}`);

    // Create notification record in database
    await this.notificationModel.findOneAndUpdate(
      {
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        category: payload.category,
      },
      {
        $setOnInsert: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          title: payload.title,
          body: payload.body,
          category: payload.category,
          actionUrl: payload.actionUrl,
          actionType: payload.actionType,
          meta: payload.meta,
          channels: payload.channels || ['inapp'],
          status: NotificationStatus.SENT,
          deliveredAt: new Date(),
          expiresAt: payload.expiresAt,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    this.logger.log(`In-app notification created for user ${payload.userId}`);
  }
}
