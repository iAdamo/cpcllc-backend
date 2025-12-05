import {
  NotificationChannel,
  NotificationCategory,
} from './notification.interface';

export interface UserPreference {
  userId: string;
  enabledChannels: NotificationChannel[];
  mutedCategories: NotificationCategory[];
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
    enabled: boolean;
  };
  pushTokens: PushToken[];
  email?: string;
  phone?: string;
  language: string;
  deviceInfo?: DeviceInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface PushToken {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  deviceId: string;
  enabled: boolean;
  createdAt: Date;
}

export interface DeviceInfo {
  platform: string;
  osVersion: string;
  appVersion: string;
  deviceModel: string;
  locale: string;
  timezone: string;
}

export interface UpdatePreferenceDto {
  enabledChannels?: NotificationChannel[];
  mutedCategories?: NotificationCategory[];
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
    enabled: boolean;
  };
  email?: string;
  phone?: string;
  language?: string;
}

export interface UpdatePushTokenDto {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  deviceId: string;
  enabled?: boolean;
}

export interface NotificationPreferenceCheck {
  userId: string;
  canSend: boolean;
  reason?: string;
  preferredChannels: NotificationChannel[];
  isQuietHours: boolean;
  isCategoryMuted: boolean;
}
