import { SocketEvents } from "@modules/socket.events";


export enum NotificationEvents {
  // Outgoing events
  NOTIFICATION_RECEIVED = SocketEvents.NOTIFICATION_RECEIVED,
  NOTIFICATION_READ = SocketEvents.NOTIFICATION_READ,

  // Incoming events
  SEND_NOTIFICATION = SocketEvents.NOTIFICATION_SEND,
  MARK_NOTIFICATIONS_READ = 'notification:mark_read',
  GET_UNREAD = 'notification:get_unread',
}
