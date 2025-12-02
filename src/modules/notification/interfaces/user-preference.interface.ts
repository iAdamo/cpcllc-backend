import {
  NotificationChannel,
  NotificationCategory,
} from './notification.interface';

export interface UserPreferenceConfig {
  userId: string;
  enabledChannels: NotificationChannel[];
  mutedCategories: NotificationCategory[];
  quietHours?: {
    start: string; // HH:MM format, e.g., "22:00"
    end: string; // HH:MM format, e.g., "08:00"
    timezone: string; // IANA timezone, e.g., "America/New_York"
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
  platform: 'ios' | 'android' | 'web';
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
  platform: 'ios' | 'android' | 'web';
  deviceId: string;
  enabled?: boolean;
}

export interface NotificationPreference {
  userId: string;
  canSend: boolean;
  preferredChannels: NotificationChannel[];
  isQuietHours: boolean;
  isCategoryMuted: boolean;
}
