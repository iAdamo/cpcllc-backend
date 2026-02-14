import {
  NotificationChannel,
  NotificationCategory,
  NotificationPriority,
} from './notification.interface';

export interface DeliveryJobData {
  notificationId: string;
  userId: string;
  tenantId?: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  actionUrl?: string;
  actionType?: string;
  metadata?: Record<string, any>;
  retryCount: number;
}

export interface DeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  deliveredAt: Date;
  retryCount: number;
}

export interface DeliveryStatus {
  channel: NotificationChannel;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'DELIVERED' | 'FAILED';
  messageId?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  retryCount: number;
}

export interface ChannelConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  rateLimit?: {
    maxRequests: number;
    timeWindow: number;
  };
}

export interface DeliveryConfig {
  [NotificationChannel.EMAIL]: ChannelConfig;
  [NotificationChannel.PUSH]: ChannelConfig;
  [NotificationChannel.SMS]: ChannelConfig;
}
