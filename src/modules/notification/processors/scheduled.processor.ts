import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';

interface ScheduledJobData {
  notificationId: string;
}

@Processor('notification.scheduled', {
  concurrency: 5,
})
@Injectable()
export class ScheduledNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledNotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<ScheduledJobData>): Promise<void> {
    const { notificationId } = job.data;
    this.logger.debug(`Processing scheduled notification: ${notificationId}`);

    try {
      const notification =
        await this.notificationService.findById(notificationId);

      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      // Queue for immediate delivery
      await this.notificationService.queueNotificationDelivery(
        notification as any, // Type assertion for simplicity
      );

      this.logger.log(`Scheduled notification delivered: ${notificationId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process scheduled notification ${notificationId}:`,
        error,
      );
      throw error;
    }
  }
}
