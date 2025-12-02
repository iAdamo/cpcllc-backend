import {
  NotificationChannel,
  NotificationCategory,
} from './notification.interface';

export interface DeliveryJobData {
  notificationId: string;
  channel: NotificationChannel;
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  actionUrl?: string;
  actionType?: string;
  meta?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface DeliveryResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  deliveredAt: Date;
  retryCount: number;
}

export interface DeliveryLog {
  channel: NotificationChannel;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
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

export interface NotificationDeliveryConfig {
  [NotificationChannel.EMAIL]: ChannelConfig;
  [NotificationChannel.PUSH]: ChannelConfig;
  [NotificationChannel.SMS]: ChannelConfig;
  [NotificationChannel.IN_APP]: ChannelConfig;
}
