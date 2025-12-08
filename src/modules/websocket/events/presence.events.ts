/**
 * Unified Presence Event System
 */

export enum PresenceEvents {
  // =========== INCOMING EVENTS (Client → Server) ===========
  // Status Updates
  UPDATE_STATUS = 'presence:update_status',

  // Subscription Management
  SUBSCRIBE = 'presence:subscribe',
  UNSUBSCRIBE = 'presence:unsubscribe',
  GET_SUBSCRIPTIONS = 'presence:get_subscriptions',

  // Activity Tracking
  HEARTBEAT = 'presence:heartbeat',
  USER_ACTIVITY = 'presence:user_activity',

  // Status Queries
  GET_STATUS = 'presence:get_status',
  GET_BATCH_STATUS = 'presence:get_batch_status',

  // =========== OUTGOING EVENTS (Server → Client) ===========
  // Status Updates (to owner)
  STATUS_UPDATED = 'presence:status_updated',

  // Status Updates (to subscribers)
  STATUS_CHANGE = 'presence:status_change', // For subscribed users
  USER_ONLINE = 'presence:user_online',
  USER_OFFLINE = 'presence:user_offline',
  USER_AWAY = 'presence:user_away',
  USER_BUSY = 'presence:user_busy',

  // Subscription Responses
  SUBSCRIBED = 'presence:subscribed',
  UNSUBSCRIBED = 'presence:unsubscribed',
  SUBSCRIPTIONS_LIST = 'presence:subscriptions_list',

  // Status Query Responses
  STATUS_RESPONSE = 'presence:status_response',
  BATCH_STATUS_RESPONSE = 'presence:batch_status_response',

  // System Events
  PRESENCE_ERROR = 'presence:error',
  HEARTBEAT_ACK = 'presence:heartbeat_ack',
}
