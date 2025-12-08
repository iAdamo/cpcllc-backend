import { SocketEvents } from '@websocket/events/socket.events';

export enum NotificationEvents {
  // Incoming events
  SEND_NOTIFICATION = SocketEvents.NOTIFICATION_SEND,
  SEND_BULK_NOTIFICATION = 'notification:send_bulk',
  MARK_AS_READ = 'notification:mark_read',
  GET_NOTIFICATIONS = 'notification:get',
  GET_UNREAD_COUNT = 'notification:get_unread_count',
  UPDATE_PREFERENCE = 'notification:update_preference',
  UPDATE_PUSH_TOKEN = 'notification:update_push_token',
  GET_PREFERENCE = 'notification:get_preference',

  // Outgoing events
  NOTIFICATION_RECEIVED = SocketEvents.NOTIFICATION_RECEIVED,
  NOTIFICATION_READ = SocketEvents.NOTIFICATION_READ,
  NOTIFICATIONS_FETCHED = 'notification:fetched',
  UNREAD_COUNT = 'notification:unread_count',
  PREFERENCE_UPDATED = 'notification:preference_updated',
  PREFERENCE_FETCHED = 'notification:preference_fetched',
  PUSH_TOKEN_UPDATED = 'notification:push_token_updated',
  BULK_NOTIFICATION_RESULT = 'notification:bulk_result',
  DELIVERY_STATUS = 'notification:delivery_status',

  NOTIFICATION_DELIVERY = 'notification.delivery',
  NOTIFICATION_SCHEDULED = 'notification.scheduled',
  NOTIFICATION_CLEANUP = 'notification.cleanup',

  GET_UNREAD = 'notification:get_unread',
}
