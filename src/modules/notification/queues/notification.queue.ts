import { RegisterQueueOptions } from '@nestjs/bullmq';
// import { QueueOptions } from 'bullmq';

export const NOTIFICATION_DELIVERY_QUEUE_CONFIG: RegisterQueueOptions = {
  name: 'notification.delivery',
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    priority: 5,
  },
  streams: {
    events: {
      maxLen: 10000,
    },
  },
};

export const NOTIFICATION_SCHEDULED_QUEUE_CONFIG: RegisterQueueOptions = {
  name: 'notification.scheduled',
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 1,
    delay: 0,
  },
};

export const NOTIFICATION_CLEANUP_QUEUE_CONFIG: RegisterQueueOptions = {
  name: 'notification.cleanup',
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 50,
    attempts: 1,
  },
};

export const QUEUE_CONFIGS = {
  DELIVERY: NOTIFICATION_DELIVERY_QUEUE_CONFIG,
  SCHEDULED: NOTIFICATION_SCHEDULED_QUEUE_CONFIG,
  CLEANUP: NOTIFICATION_CLEANUP_QUEUE_CONFIG,
} as const;
