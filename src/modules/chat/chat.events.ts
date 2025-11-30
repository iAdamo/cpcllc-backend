import { SocketEvents } from '../websocket/socket.events';

/**
 * Chat-specific event definitions
 */
export enum ChatEvents {
  // Outgoing events
  MESSAGE_SENT = SocketEvents.CHAT_MESSAGE_SENT,
  MESSAGE_DELIVERED = SocketEvents.CHAT_MESSAGE_DELIVERED,
  MESSAGE_READ = SocketEvents.CHAT_MESSAGE_READ,
  TYPING_START = SocketEvents.CHAT_TYPING_START,
  TYPING_STOP = SocketEvents.CHAT_TYPING_STOP,
  USER_JOINED = 'chat:user_joined',
  USER_LEFT = 'chat:user_left',
  CONVERSATION_UPDATED = 'chat:conversation_updated',

  // Incoming events
  SEND_MESSAGE = SocketEvents.CHAT_SEND_MESSAGE,
  JOIN_ROOM = SocketEvents.CHAT_JOIN_ROOM,
  LEAVE_ROOM = SocketEvents.CHAT_LEAVE_ROOM,
  MARK_AS_READ = 'chat:mark_as_read',
  TYPING_INDICATOR = 'chat:typing_indicator',
}
