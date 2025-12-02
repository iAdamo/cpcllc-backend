import { DeliveryLog } from "./delivery-job.interface";

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'inapp',
}

export enum NotificationCategory {
  MESSAGE = 'MESSAGE',
  PAYMENT = 'PAYMENT',
  JOB_UPDATE = 'JOB_UPDATE',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  MARKETING = 'MARKETING',
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  ORDER_UPDATE = 'ORDER_UPDATE',
  COMMENT = 'COMMENT',
  LIKE = 'LIKE',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export enum ActionType {
  OPEN_CHAT = 'OPEN_CHAT',
  VIEW_JOB = 'VIEW_JOB',
  NAVIGATE = 'NAVIGATE',
  OPEN_URL = 'OPEN_URL',
  VIEW_PAYMENT = 'VIEW_PAYMENT',
  VIEW_PROFILE = 'VIEW_PROFILE',
  DEEP_LINK = 'DEEP_LINK',
}

export interface NotificationPayload {
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  actionType?: ActionType;
  meta?: Record<string, any>;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduledAt?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: NotificationStatus;
  actionUrl?: string;
  actionType?: ActionType;
  meta?: Record<string, any>;
  channels: NotificationChannel[];
  deliveries: DeliveryLog[];
  readAt?: Date;
  expiresAt?: Date;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationDto {
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  actionType?: ActionType;
  meta?: Record<string, any>;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduledAt?: Date;
}

export interface CreateBulkNotificationDto {
  userIds: string[];
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  actionType?: ActionType;
  meta?: Record<string, any>;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduledAt?: Date;
}

export interface UpdateNotificationDto {
  status?: NotificationStatus;
  readAt?: Date;
}

export interface MarkAsReadDto {
  notificationIds: string[];
}

export interface FilterNotificationsDto {
  userId: string;
  tenantId?: string;
  categories?: NotificationCategory[];
  statuses?: NotificationStatus[];
  channels?: NotificationChannel[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}
