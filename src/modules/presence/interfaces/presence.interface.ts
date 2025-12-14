export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  deviceId?: string;
  sessionId?: string;
  customStatus?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  timestamp?: number;
  deviceInfo?: DeviceInfo;
}

export interface UpdatePresenceDto {
  status?: PresenceStatus;
  customStatus?: string;
  metadata?: Record<string, any>;
  lastSeen?: number;
  deviceInfo?: DeviceInfo;
  state?: string;
}

export interface SubscribePresenceDto {
  userIds: string[];
}

export interface PresenceResponse {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  customStatus?: string;
  isOnline: boolean;
  deviceId?: string;
}

export interface BatchPresenceResponse {
  presences: PresenceResponse[];
  timestamp: Date;
}

export interface SubscriptionResponse {
  userId: string;
  subscribedAt: Date;
}

export interface HeartbeatDto {
  timestamp: number;
  deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
  platform: string;
  osVersion: string;
  appVersion: string;
  deviceModel: string;
  batteryLevel?: number;
  networkType?: string;
}

export interface PresenceSubscription {
  subscriberId: string;
  targetId: string;
  subscribedAt: Date;
  notificationsEnabled: boolean;
}

export interface PresenceStats {
  totalUsers: number;
  onlineUsers: number;
  awayUsers: number;
  busyUsers: number;
  peakConcurrent: number;
}

export enum PRESENCE_STATUS {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
  DO_NOT_DISTURB = 'dnd',
}

export type PresenceStatus =
  (typeof PRESENCE_STATUS)[keyof typeof PRESENCE_STATUS];

export const PRESENCE_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  INACTIVE_THRESHOLD: 120000, // 2 minutes → away
  OFFLINE_THRESHOLD: 300000, // 5 minutes → offline
  CLEANUP_INTERVAL: 60000, // 1 minute
  PRESENCE_TTL: 300, // 5 minutes in Redis
  MAX_SUBSCRIPTIONS: 1000, // Max users one can subscribe to
} as const;
