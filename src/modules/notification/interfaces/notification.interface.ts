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
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum ActionType {
  OPEN_CHAT = 'OPEN_CHAT',
  VIEW_JOB = 'VIEW_JOB',
  NAVIGATE = 'NAVIGATE',
  OPEN_URL = 'OPEN_URL',
}

export interface NotificationPayload {
  userId: string;
  tenantId?: string;
  title: string;
  body: string;
  category: NotificationCategory;
  actionUrl?: string;
  actionType?: ActionType;
  meta?: Record<string, any>;
  channels?: NotificationChannel[];
  expiresAt?: Date;
}

export interface DeliveryJobData {
  notificationId: string;
  channel: NotificationChannel;
  payload: NotificationPayload;
}

export interface UserPreferenceConfig {
  userId: string;
  enabledChannels: NotificationChannel[];
  mutedCategories: NotificationCategory[];
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  pushTokens: string[];
  email?: string;
  phone?: string;
}
