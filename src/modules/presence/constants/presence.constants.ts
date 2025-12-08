/**
 * Unified Presence Event System
 */

export const PRESENCE_EVENTS = {
  // =========== INCOMING EVENTS (Client → Server) ===========
  // Status Updates
  UPDATE_STATUS: 'presence:update_status',

  // Subscription Management
  SUBSCRIBE: 'presence:subscribe',
  UNSUBSCRIBE: 'presence:unsubscribe',
  GET_SUBSCRIPTIONS: 'presence:get_subscriptions',

  // Activity Tracking
  HEARTBEAT: 'presence:heartbeat',
  USER_ACTIVITY: 'presence:user_activity',

  // Status Queries
  GET_STATUS: 'presence:get_status',
  GET_BATCH_STATUS: 'presence:get_batch_status',

  // =========== OUTGOING EVENTS (Server → Client) ===========
  // Status Updates (to owner)
  STATUS_UPDATED: 'presence:status_updated',

  // Status Updates (to subscribers)
  STATUS_CHANGE: 'presence:status_change', // For subscribed users
  USER_ONLINE: 'presence:user_online',
  USER_OFFLINE: 'presence:user_offline',
  USER_AWAY: 'presence:user_away',
  USER_BUSY: 'presence:user_busy',

  // Subscription Responses
  SUBSCRIBED: 'presence:subscribed',
  UNSUBSCRIBED: 'presence:unsubscribed',
  SUBSCRIPTIONS_LIST: 'presence:subscriptions_list',

  // Status Query Responses
  STATUS_RESPONSE: 'presence:status_response',
  BATCH_STATUS_RESPONSE: 'presence:batch_status_response',

  // System Events
  PRESENCE_ERROR: 'presence:error',
  HEARTBEAT_ACK: 'presence:heartbeat_ack',
} as const;

export const PRESENCE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  BUSY: 'busy',
  DO_NOT_DISTURB: 'dnd',
} as const;

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
