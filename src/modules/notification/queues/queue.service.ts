import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, Metrics, Worker } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name);
  private readonly redis: IORedis;

  constructor(
    @InjectQueue('notification.delivery')
    private readonly deliveryQueue: Queue,

    @InjectQueue('notification.scheduled')
    private readonly scheduledQueue: Queue,

    @InjectQueue('notification.cleanup')
    private readonly cleanupQueue: Queue,
  ) {
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit() {
    await this.initializeQueues();
  }

  private async initializeQueues(): Promise<void> {
    try {
      // Clean up any stalled jobs on startup
      await this.cleanupStalledJobs();

      // Get initial metrics
      const metrics = await this.getQueueMetrics();
      this.logger.log('Queues initialized successfully', metrics);
    } catch (error) {
      this.logger.error('Failed to initialize queues:', error);
    }
  }

  async getQueueMetrics(): Promise<Record<string, any>> {
    const [delivery, scheduled, cleanup] = await Promise.all([
      this.getQueueStatus(this.deliveryQueue),
      this.getQueueStatus(this.scheduledQueue),
      this.getQueueStatus(this.cleanupQueue),
    ]);

    return {
      delivery,
      scheduled,
      cleanup,
      timestamp: new Date().toISOString(),
    };
  }

  private async getQueueStatus(queue: Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

    const rate = await this.getProcessingRate(queue);

    return {
      name: queue.name,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      rate, // jobs per second
    };
  }

  private async getProcessingRate(queue: Queue): Promise<number> {
    try {
      const metrics = await queue.getMetrics('completed');
      if (!metrics?.meta) return 0;

      const { count, prevCount, prevTS } = metrics.meta;

      const deltaCount = count - prevCount;
      const durationMs = Date.now() - prevTS;

      if (durationMs <= 0 || deltaCount <= 0) return 0;

      return (deltaCount / durationMs) * 1000; // jobs per second
    } catch (error) {
      this.logger.error(
        `Failed to calculate processing rate for queue ${queue.name}:`,
        error,
      );
      return 0;
    }
  }

  async cleanupStalledJobs(gracePeriodMs: number = 300000): Promise<number> {
    let cleaned = 0;

    for (const queue of [
      this.deliveryQueue,
      this.scheduledQueue,
      this.cleanupQueue,
    ]) {
      const activeJobs = await queue.getActive();
      const now = Date.now();

      for (const job of activeJobs) {
        const jobAge = now - job.timestamp;

        if (jobAge > gracePeriodMs) {
          this.logger.warn(
            `Cleaning up stalled job ${job.id} from queue ${queue.name}`,
          );

          await job.moveToFailed(
            new Error('Job stalled and cleaned up'),
            undefined,
            false,
          );
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  async retryFailedJobs(
    queueName: string,
    count: number = 100,
  ): Promise<number> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failedJobs = await queue.getFailed(0, count - 1);
    let retried = 0;

    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }

    this.logger.log(`Retried ${retried} failed jobs from queue ${queueName}`);
    return retried;
  }

  async emptyQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.drain();
      this.logger.log(`Emptied queue ${queueName}`);
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.pause();
      this.logger.log(`Paused queue ${queueName}`);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Resumed queue ${queueName}`);
    }
  }

  async getJobDetails(queueName: string, jobId: string): Promise<any> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
      stacktrace: job.stacktrace,
    };
  }

  private getQueueByName(queueName: string): Queue | null {
    switch (queueName) {
      case 'notification.delivery':
        return this.deliveryQueue;
      case 'notification.scheduled':
        return this.scheduledQueue;
      case 'notification.cleanup':
        return this.cleanupQueue;
      default:
        return null;
    }
  }

  async getRedisInfo(): Promise<any> {
    try {
      const info = await this.redis.info();
      const lines = info.split('\r\n');
      const parsedInfo: Record<string, string> = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          parsedInfo[key] = value;
        }
      }

      return {
        version: parsedInfo['redis_version'],
        usedMemory: parsedInfo['used_memory_human'],
        connectedClients: parsedInfo['connected_clients'],
        uptime: parsedInfo['uptime_in_seconds'],
        memoryFragmentationRatio: parsedInfo['mem_fragmentation_ratio'],
        totalConnectionsReceived: parsedInfo['total_connections_received'],
        totalCommandsProcessed: parsedInfo['total_commands_processed'],
        keyspaceHits: parsedInfo['keyspace_hits'],
        keyspaceMisses: parsedInfo['keyspace_misses'],
        hitRate:
          parsedInfo['keyspace_hits'] && parsedInfo['keyspace_misses']
            ? parseInt(parsedInfo['keyspace_hits']) /
              (parseInt(parsedInfo['keyspace_hits']) +
                parseInt(parsedInfo['keyspace_misses']))
            : 0,
      };
    } catch (error: any) {
      this.logger.error('Failed to get Redis info:', error);
      return { error: error.message };
    }
  }
}
