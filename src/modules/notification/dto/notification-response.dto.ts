import {
  NotificationChannel,
  NotificationCategory,
  NotificationStatus,
  ActionType,
} from '../interfaces/notification.interface';

export class NotificationResponseDto {
  id: string;
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  actionUrl?: string;
  actionType?: ActionType;
  meta?: Record<string, any>;
  channels: NotificationChannel[];
  status: NotificationStatus;
  readAt?: Date;
  deliveredAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
