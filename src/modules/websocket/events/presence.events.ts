import { SocketEvents } from './socket.events';

export enum PresenceEvents {
  // Outgoing events
  PRESENCE_UPDATE = SocketEvents.PRESENCE_UPDATE,
  PRESENCE_ONLINE = SocketEvents.PRESENCE_ONLINE,
  PRESENCE_OFFLINE = SocketEvents.PRESENCE_OFFLINE,

  // Incoming events
  UPDATE_PRESENCE = SocketEvents.PRESENCE_UPDATE,
  SUBSCRIBE_PRESENCE = SocketEvents.PRESENCE_SUBSCRIBE,
  UNSUBSCRIBE_PRESENCE = 'presence:unsubscribe',
}
