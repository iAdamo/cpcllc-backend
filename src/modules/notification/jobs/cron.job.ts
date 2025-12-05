import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CronJob {
  private readonly logger = new Logger(CronJob.name);

  constructor(
    @InjectQueue('notification.cleanup')
    private readonly cleanupQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications(): Promise<void> {
    this.logger.log('Starting notification cleanup job');

    await this.cleanupQueue.add('cleanup', {
      type: 'expired',
      days: 30,
    });

    await this.cleanupQueue.add('cleanup', {
      type: 'archived',
      days: 90,
    });
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldLogs(): Promise<void> {
    this.logger.log('Starting log cleanup job');

    await this.cleanupQueue.add('cleanup', {
      type: 'logs',
      days: 180,
    });
  }
}
