import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailAdapter, PushAdapter, InAppAdapter } from '../adapters';
import {
  DeliveryJobData,
  NotificationPayload,
} from '../interfaces/notification.interface';

@Injectable()
@Processor('notification-delivery', {
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 1000,
  },
})
export class NotificationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly channelAdapters: Map<string, any> = new Map();

  constructor(
    private readonly emailAdapter: EmailAdapter,
    private readonly pushAdapter: PushAdapter,
    // private readonly smsAdapter: SmsAdapter,
    private readonly inAppAdapter: InAppAdapter,
  ) {
    super();
  }

  onModuleInit() {
    // Register adapters
    this.channelAdapters.set('email', this.emailAdapter);
    this.channelAdapters.set('push', this.pushAdapter);
    // this.channelAdapters.set('sms', this.smsAdapter);
    this.channelAdapters.set('inapp', this.inAppAdapter);
  }

  async process(job: Job<DeliveryJobData>): Promise<any> {
    const { channel, payload } = job.data;
    this.logger.log(
      `Processing ${channel} delivery for user ${payload.userId}`,
    );

    const adapter = this.channelAdapters.get(channel);
    if (!adapter) {
      throw new Error(`No adapter found for channel: ${channel}`);
    }

    try {
      // Get user-specific options for the adapter
      const options = await this.getAdapterOptions(payload.userId, channel);

      await adapter.send(payload, options);

      this.logger.log(
        `Successfully delivered ${channel} notification to user ${payload.userId}`,
      );

      return { success: true, channel, userId: payload.userId };
    } catch (error) {
      this.logger.error(
        `Failed to deliver ${channel} notification to user ${payload.userId}: ${error}`,
        error,
      );

      // Rethrow to trigger retry mechanism
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job) {
    this.logger.warn(`Job ${job.id} stalled`);
  }

  private async getAdapterOptions(
    userId: string,
    channel: string,
  ): Promise<any> {
    // In a real implementation, you would fetch user-specific configuration
    // like email address, phone number, push tokens, etc.

    const baseOptions: any = {};

    switch (channel) {
      case 'email':
        baseOptions.email = `user-${userId}@example.com`; // Replace with actual email lookup
        break;
      case 'push':
        baseOptions.pushTokens = [`token-for-${userId}`]; // Replace with actual token lookup
        break;
      case 'sms':
        baseOptions.phone = '+1234567890'; // Replace with actual phone lookup
        break;
    }

    return baseOptions;
  }
}
