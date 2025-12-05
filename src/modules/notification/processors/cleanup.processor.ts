import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification as NotificationDocument } from '../schemas/notification.schema';
import { NotificationLog as NotificationLogDocument } from '../schemas/notification-log.schema';
import { NotificationStatus } from '../interfaces/notification.interface';

interface CleanupJobData {
  type: 'expired' | 'archived' | 'logs' | 'failed' | 'orphaned';
  days?: number;
  limit?: number;
}

@Processor('notification.cleanup', {
  concurrency: 1, // Single thread to avoid database pressure
  limiter: {
    max: 1,
    duration: 5000, // 1 job every 5 seconds
  },
})
@Injectable()
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectModel(NotificationDocument.name)
    private readonly notificationModel: Model<NotificationDocument>,

    @InjectModel(NotificationLogDocument.name)
    private readonly notificationLogModel: Model<NotificationLogDocument>,
  ) {
    super();
  }

  async process(job: Job<CleanupJobData>): Promise<{
    deleted: number;
    type: string;
    duration: number;
  }> {
    const startTime = Date.now();
    const { type, days = 30, limit = 10000 } = job.data;

    this.logger.log(`Starting cleanup job: ${type} (older than ${days} days)`);

    let deleted = 0;

    try {
      switch (type) {
        case 'expired':
          deleted = await this.cleanupExpiredNotifications(days, limit);
          break;

        case 'archived':
          deleted = await this.cleanupArchivedNotifications(days, limit);
          break;

        case 'logs':
          deleted = await this.cleanupOldLogs(days, limit);
          break;

        case 'failed':
          deleted = await this.cleanupFailedNotifications(days, limit);
          break;

        case 'orphaned':
          deleted = await this.cleanupOrphanedNotifications(days, limit);
          break;

        default:
          this.logger.warn(`Unknown cleanup type: ${type}`);
      }

      const duration = Date.now() - startTime;

      this.logger.log(
        `Cleanup ${type} completed: ${deleted} records deleted in ${duration}ms`,
      );

      return {
        deleted,
        type,
        duration,
      };
    } catch (error) {
      this.logger.error(`Cleanup job failed:`, error);
      throw error;
    }
  }

  private async cleanupExpiredNotifications(
    days: number,
    limit: number,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deleted = 0;
    let hasMore = true;

    while (hasMore && deleted < limit) {
      const batch = await this.notificationModel
        .find({
          expiresAt: { $lt: cutoffDate },
          status: { $ne: NotificationStatus.ARCHIVED },
        })
        .limit(this.BATCH_SIZE)
        .select('_id')
        .lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const ids = batch.map((doc) => doc._id);
      const result = await this.notificationModel.deleteMany({
        _id: { $in: ids },
      });

      deleted += result.deletedCount;

      this.logger.debug(
        `Deleted ${result.deletedCount} expired notifications (total: ${deleted})`,
      );

      // Small delay to prevent database overload
      if (batch.length === this.BATCH_SIZE) {
        await this.delay(100);
      }
    }

    return deleted;
  }

  private async cleanupArchivedNotifications(
    days: number,
    limit: number,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deleted = 0;
    let hasMore = true;

    while (hasMore && deleted < limit) {
      const batch = await this.notificationModel
        .find({
          status: NotificationStatus.ARCHIVED,
          updatedAt: { $lt: cutoffDate },
        })
        .limit(this.BATCH_SIZE)
        .select('_id')
        .lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const ids = batch.map((doc) => doc._id);
      const result = await this.notificationModel.deleteMany({
        _id: { $in: ids },
      });

      deleted += result.deletedCount;

      this.logger.debug(
        `Deleted ${result.deletedCount} archived notifications (total: ${deleted})`,
      );

      if (batch.length === this.BATCH_SIZE) {
        await this.delay(100);
      }
    }

    return deleted;
  }

  private async cleanupOldLogs(days: number, limit: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deleted = 0;
    let hasMore = true;

    while (hasMore && deleted < limit) {
      const batch = await this.notificationLogModel
        .find({
          createdAt: { $lt: cutoffDate },
        })
        .limit(this.BATCH_SIZE)
        .select('_id')
        .lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const ids = batch.map((doc) => doc._id);
      const result = await this.notificationLogModel.deleteMany({
        _id: { $in: ids },
      });

      deleted += result.deletedCount;

      this.logger.debug(
        `Deleted ${result.deletedCount} old logs (total: ${deleted})`,
      );

      if (batch.length === this.BATCH_SIZE) {
        await this.delay(100);
      }
    }

    return deleted;
  }

  private async cleanupFailedNotifications(
    days: number,
    limit: number,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let deleted = 0;
    let hasMore = true;

    while (hasMore && deleted < limit) {
      const batch = await this.notificationModel
        .find({
          status: NotificationStatus.FAILED,
          updatedAt: { $lt: cutoffDate },
          'deliveries.status': 'FAILED',
        })
        .limit(this.BATCH_SIZE)
        .select('_id')
        .lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const ids = batch.map((doc) => doc._id);
      const result = await this.notificationModel.deleteMany({
        _id: { $in: ids },
      });

      deleted += result.deletedCount;

      this.logger.debug(
        `Deleted ${result.deletedCount} failed notifications (total: ${deleted})`,
      );

      if (batch.length === this.BATCH_SIZE) {
        await this.delay(100);
      }
    }

    return deleted;
  }

  private async cleanupOrphanedNotifications(
    days: number,
    limit: number,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find notifications with no valid deliveries and old timestamps
    const result = await this.notificationModel.deleteMany({
      updatedAt: { $lt: cutoffDate },
      $or: [{ deliveries: { $size: 0 } }, { 'deliveries.status': 'PENDING' }],
      status: NotificationStatus.PENDING,
    });

    this.logger.debug(`Deleted ${result.deletedCount} orphaned notifications`);

    return result.deletedCount;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CleanupJobData>, result: any): void {
    this.logger.debug(
      `Cleanup job ${job.id} completed: ${JSON.stringify(result)}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CleanupJobData>, error: Error): void {
    this.logger.error(`Cleanup job ${job.id} failed:`, error);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`Cleanup job ${jobId} stalled`);
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.error('Cleanup processor error:', error);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
