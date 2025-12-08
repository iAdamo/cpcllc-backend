/**
 * Centralized WebSocket event definitions for versioning and maintainability
 * Events follow pattern: module:action
 */
export enum SocketEvents {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',

  // Chat events
  CHAT_SEND_MESSAGE = 'chat:send_message',
  CHAT_MESSAGE_SENT = 'chat:message_sent',
  CHAT_MESSAGE_DELIVERED = 'chat:message_delivered',
  CHAT_MESSAGE_READ = 'chat:message_read',
  CHAT_TYPING_START = 'chat:typing_start',
  CHAT_TYPING_STOP = 'chat:typing_stop',
  CHAT_JOIN_ROOM = 'chat:join_room',
  CHAT_LEAVE_ROOM = 'chat:leave_room',

  // Notification events
  NOTIFICATION_SEND = 'notification:send',
  NOTIFICATION_RECEIVED = 'notification:received',
  NOTIFICATION_READ = 'notification:read',

  // Presence events
  PRESENCE_UPDATE = 'presence:update',
  PRESENCE_ONLINE = 'presence:online',
  PRESENCE_OFFLINE = 'presence:offline',
  PRESENCE_SUBSCRIBE = 'presence:subscribe',

  // System events
  ERROR = 'error',
  RATE_LIMIT_EXCEEDED = 'rate_limit:exceeded',
}

/**
 * Event versioning for backward compatibility
 */
export interface EventEnvelope<T = any> {
  version: string; // e.g., '1.0.0'
  event: SocketEvents;
  timestamp: number;
  payload: T;
  metadata?: {
    requestId?: string;
    deviceId?: string;
    sessionId?: string;
  };
}

/**
 * Supported event versions
 */
export const SUPPORTED_VERSIONS = ['1.0.0', '1.1.0'];
