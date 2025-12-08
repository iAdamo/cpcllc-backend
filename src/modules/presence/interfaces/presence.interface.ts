export interface IPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  deviceId: string;
  sessionId: string;
  customStatus?: string;
  expiresAt?: Date;
}

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
  DO_NOT_DISTURB = 'dnd',
}

export class UpdatePresenceDto {
  status: PresenceStatus;
  customStatus?: string;
}

export class SubscribePresenceDto {
  userIds: string[];
}
