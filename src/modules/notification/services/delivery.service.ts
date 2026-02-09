import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationCategory,
} from '../interfaces/notification.interface';
import {
  DeliveryJobData,
  DeliveryResult,
  DeliveryConfig,
} from '../interfaces/delivery.interface';
import {
  DEFAULT_CHANNEL_CONFIG,
  PRIORITY_MAPPING,
} from '../constants/notification.constants';
// import { EmailService } from '@notification/services/email.service';
import { PushService } from '@notification/services/push.service';
import { SmsService } from '@notification/services/sms.service';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);
  private readonly config: DeliveryConfig = DEFAULT_CHANNEL_CONFIG;

  constructor(
    @InjectQueue('notification.delivery')
    private readonly deliveryQueue: Queue,
    // private readonly emailService: EmailService,
    private readonly pushService: PushService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Queue delivery jobs for all channels of a notification
   */
  async queueNotificationDelivery(
    notificationId: string,
    userId: string,
    tenantId: string,
    title: string,
    body: string,
    category: NotificationCategory,
    priority: NotificationPriority,
    channels: NotificationChannel[],
    metadata?: Record<string, any>,
    retryCount: number = 0,
  ): Promise<void> {
    const jobPriority = this.getJobPriority(priority);

    for (const channel of channels) {
      const jobData: DeliveryJobData = {
        notificationId,
        userId,
        tenantId,
        channel,
        title,
        body,
        category,
        priority,
        metadata,
        retryCount,
      };

      await this.deliveryQueue.add(
        `delivery:${channel}:${notificationId}:${retryCount}`,
        jobData,
        {
          jobId: `delivery_${notificationId}_${channel}_${retryCount}`,
          priority: jobPriority,
          attempts: this.config[channel].maxRetries - retryCount,
          backoff: {
            type: 'exponential',
            delay: this.config[channel].retryDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      );

      this.logger.debug(
        `Queued ${channel} delivery for notification: ${notificationId}`,
      );
    }
  }

  /**
   * Deliver a single notification job
   */
  async deliver(jobData: DeliveryJobData): Promise<DeliveryResult> {
    const { channel, notificationId, retryCount } = jobData;
    const channelConfig = this.config[channel];

    if (!channelConfig.enabled) {
      throw new Error(`Channel ${channel} is disabled`);
    }

    try {
      let result: DeliveryResult;

      switch (channel) {
        // case NotificationChannel.EMAIL:
        //   result = await this.deliverEmail(jobData);
        //   break;
        case NotificationChannel.PUSH:
          result = await this.deliverPush(jobData);
          break;
        case NotificationChannel.SMS:
          result = await this.deliverSms(jobData);
          break;
        case NotificationChannel.IN_APP:
          result = await this.deliverInApp(jobData);
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

      this.logger.log(
        `Successfully delivered via ${channel}: ${notificationId}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(
        `Delivery failed via ${channel}: ${notificationId}`,
        error,
      );

      if (retryCount < channelConfig.maxRetries - 1) {
        await this.queueRetry(jobData, retryCount + 1);
      }

      return {
        success: false,
        channel,
        error: error.message,
        deliveredAt: new Date(),
        retryCount: retryCount + 1,
      };
    }
  }

  // private async deliverEmail(
  //   jobData: DeliveryJobData,
  // ): Promise<DeliveryResult> {
  //   const { userId, title, body, metadata } = jobData;

  //   const result = await this.emailService.send({
  //     to: metadata?.email || `${userId}@example.com`,
  //     subject: title,
  //     html: this.generateEmailTemplate(title, body, metadata),
  //   });

  //   return {
  //     success: result.success,
  //     channel: NotificationChannel.EMAIL,
  //     messageId: result.messageId,
  //     deliveredAt: new Date(),
  //     retryCount: jobData.retryCount,
  //   };
  // }

  private async deliverPush(jobData: DeliveryJobData): Promise<DeliveryResult> {
    const { userId, title, body, metadata } = jobData;

    const result = await this.pushService.send({
      to: userId,
      title,
      body,
      data: metadata,
      priority:
        jobData.priority === NotificationPriority.HIGH ? 'high' : 'normal',
    });

    return {
      success: result.success,
      channel: NotificationChannel.PUSH,
      messageId: result.messageId,
      deliveredAt: new Date(),
      retryCount: jobData.retryCount,
    };
  }

  private async deliverSms(jobData: DeliveryJobData): Promise<DeliveryResult> {
    const { phone, title, body } = jobData.metadata || {};

    if (!phone) {
      throw new Error('Phone number required for SMS delivery');
    }

    const result = await this.smsService.send({
      to: phone,
      body: `${title}: ${body}`,
    });

    return {
      success: result.success,
      channel: NotificationChannel.SMS,
      messageId: result.messageId,
      deliveredAt: new Date(),
      retryCount: jobData.retryCount,
    };
  }

  private async deliverInApp(
    jobData: DeliveryJobData,
  ): Promise<DeliveryResult> {
    // In-app delivery is handled by WebSocket gateway
    // This just marks it as delivered
    return {
      success: true,
      channel: NotificationChannel.IN_APP,
      deliveredAt: new Date(),
      retryCount: jobData.retryCount,
    };
  }

  /**
   * Queue a retry for failed delivery
   */
  private async queueRetry(
    jobData: DeliveryJobData,
    newRetryCount: number,
  ): Promise<void> {
    const channelConfig = this.config[jobData.channel];
    const delay = channelConfig.retryDelay * newRetryCount;

    await this.deliveryQueue.add(
      `retry:${jobData.channel}:${jobData.notificationId}:${newRetryCount}`,
      { ...jobData, retryCount: newRetryCount },
      {
        jobId: `retry_${jobData.notificationId}_${jobData.channel}_${newRetryCount}`,
        delay,
        priority: 1, // High priority for retries
        attempts: channelConfig.maxRetries - newRetryCount,
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
  }

  /**
   * Convert notification priority to job priority for BullMQ
   */
  private getJobPriority(priority: NotificationPriority): number {
    return PRIORITY_MAPPING[priority] || 5;
  }

  private generateEmailTemplate(
    title: string,
    body: string,
    metadata?: any,
  ): string {
    // Simple template - in production use a proper templating engine
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; }
          .content { padding: 20px; background: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>${body}</p>
            ${metadata?.actionUrl ? `<p><a href="${metadata.actionUrl}">View Details</a></p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
