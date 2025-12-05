import { DeliveryStatus } from "./delivery.interface";

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
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
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
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
  priority?: NotificationPriority;
  actionUrl?: string;
  actionType?: ActionType;
  metadata?: Record<string, any>;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduledAt?: Date;
}

export interface CreateNotificationDto {
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionType?: ActionType;
  metadata?: Record<string, any>;
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
  priority?: NotificationPriority;
  actionUrl?: string;
  actionType?: ActionType;
  metadata?: Record<string, any>;
  channels?: NotificationChannel[];
  expiresAt?: Date;
  scheduledAt?: Date;
}

export interface UpdateNotificationDto {
  status?: NotificationStatus;
  readAt?: Date;
  metadata?: Record<string, any>;
}

export interface FilterNotificationsDto {
  userId: string;
  tenantId?: string;
  categories?: NotificationCategory[];
  statuses?: NotificationStatus[];
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  actionUrl?: string;
  actionType?: ActionType;
  metadata?: Record<string, any>;
  channels: NotificationChannel[];
  deliveries: DeliveryStatus[];
  readAt?: Date;
  expiresAt?: Date;
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
