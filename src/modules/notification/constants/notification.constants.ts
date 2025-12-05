import {
  NotificationChannel,
  NotificationCategory,
  NotificationPriority,
} from '../interfaces/notification.interface';
import {
  ChannelConfig,
  DeliveryConfig,
} from '../interfaces/delivery.interface';

export const DEFAULT_CHANNEL_CONFIG: DeliveryConfig = {
  [NotificationChannel.EMAIL]: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 30000,
    rateLimit: { maxRequests: 100, timeWindow: 3600 },
  },
  [NotificationChannel.PUSH]: {
    enabled: true,
    maxRetries: 5,
    retryDelay: 2000,
    timeout: 10000,
    rateLimit: { maxRequests: 1000, timeWindow: 3600 },
  },
  [NotificationChannel.SMS]: {
    enabled: true,
    maxRetries: 2,
    retryDelay: 10000,
    timeout: 60000,
    rateLimit: { maxRequests: 50, timeWindow: 3600 },
  },
  [NotificationChannel.IN_APP]: {
    enabled: true,
    maxRetries: 1,
    retryDelay: 1000,
    timeout: 5000,
  },
};

export const PRIORITY_MAPPING: Record<NotificationPriority, number> = {
  [NotificationPriority.URGENT]: 1,
  [NotificationPriority.HIGH]: 2,
  [NotificationPriority.NORMAL]: 5,
  [NotificationPriority.LOW]: 10,
};

export const NOTIFICATION_EVENTS = {
  // Incoming events
  SEND_NOTIFICATION: 'notification:send',
  SEND_BULK_NOTIFICATION: 'notification:send_bulk',
  MARK_AS_READ: 'notification:mark_read',
  GET_NOTIFICATIONS: 'notification:get',
  GET_UNREAD_COUNT: 'notification:get_unread_count',
  UPDATE_PREFERENCE: 'notification:update_preference',
  UPDATE_PUSH_TOKEN: 'notification:update_push_token',
  GET_PREFERENCE: 'notification:get_preference',

  // Outgoing events
  NOTIFICATION_RECEIVED: 'notification:received',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATIONS_FETCHED: 'notification:fetched',
  UNREAD_COUNT: 'notification:unread_count',
  PREFERENCE_UPDATED: 'notification:preference_updated',
  PREFERENCE_FETCHED: 'notification:preference_fetched',
  PUSH_TOKEN_UPDATED: 'notification:push_token_updated',
  BULK_RESULT: 'notification:bulk_result',
};

export const QUEUE_NAMES = {
  NOTIFICATION_DELIVERY: 'notification.delivery',
  NOTIFICATION_SCHEDULED: 'notification.scheduled',
  NOTIFICATION_CLEANUP: 'notification.cleanup',
} as const;
