import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryJobData,
  DeliveryResult,
} from '../interfaces/delivery.interface';
import { NotificationService } from '../services/notification.service';
import { DeliveryService } from '../services/delivery.service';

@Processor('notification.delivery', {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 1000,
  },
})
@Injectable()
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly deliveryService: DeliveryService,
  ) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<DeliveryResult> {
    this.logger.debug(`Processing delivery job: ${job.id}`);

    try {
      const result = await this.deliveryService.deliver(job.data);

      if (result.success) {
        await this.notificationService.updateStatus(
          job.data.notificationId,
          job.data.channel,
          'SENT',
        );
      } else if (result.error && result.retryCount >= 3) {
        await this.notificationService.updateStatus(
          job.data.notificationId,
          job.data.channel,
          'FAILED',
          result.error,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to process job ${job.id}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DeliveryJobData>, result: DeliveryResult): void {
    this.logger.debug(`Job ${job.id} completed via ${result.channel}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DeliveryJobData>, error: Error): void {
    this.logger.error(`Job ${job.id} failed:`, error);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`Job ${jobId} stalled`);
  }
}
