import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseAdapter,
  NotificationAdapter,
} from '../interfaces/adapter.interface';
import { NotificationPayload } from '../interfaces/notification.interface';

@Injectable()
export class PushAdapter extends BaseAdapter implements NotificationAdapter {
  readonly channel = 'push';
  private readonly logger = new Logger(PushAdapter.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async send(payload: NotificationPayload, options?: any): Promise<void> {
    this.validatePayload(payload);

    const pushTokens = options?.pushTokens || [];

    if (pushTokens.length === 0) {
      this.logger.warn(`No push tokens available for user ${payload.userId}`);
      return;
    }

    // In production, integrate with FCM, APNS, etc.
    const pushMessage = {
      tokens: pushTokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        actionUrl: payload.actionUrl,
        actionType: payload.actionType,
        category: payload.category,
        ...payload.meta,
      },
    };

    this.logger.log(`Sending push notification to user ${payload.userId}`);

    // Stub implementation
    this.logger.debug('Push payload:', pushMessage);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.logger.log(`Push notification sent to user ${payload.userId}`);
  }
}
