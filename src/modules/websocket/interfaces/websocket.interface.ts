import { Socket } from 'socket.io';
import { Server, DefaultEventsMap } from 'socket.io';
/**
 * Extended Socket interface with user context
 */
export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    email: string;
    roles: 'Client' | 'Provider' | 'Admin';
    deviceId: string;
    sessionId: string;
  };
}

/**
 * User session information
 */
export interface UserSession {
  userId: string;
  status: string;
  lastSeen: Date;
  socketId?: string;
  deviceId: string;
  sessionId: string;
  metadata?: Record<string, any>;
  customStatus?: string;
  connectedAt: Date;
}

/**
 * Socket registry for tracking user connections
 */
export interface SocketRegistry {
  [userId: string]: {
    [deviceId: string]: {
      socketId: string;
      sessionId: string;
      lastSeen: Date;
    };
  };
}

export interface EventHandlerContext {
  server: Server<DefaultEventsMap, any>;
  event: string;
  data: any;
  socket: AuthenticatedSocket;
}

export interface EventHandler {
  canHandle(event: string): boolean;
  handle(context: EventHandlerContext): Promise<void>;
}


/**
 * Event handler interface for module gateways
 */
// export interface EventHandler {
//   canHandle(event: string): boolean;
//   handle(
//     server: Server<DefaultEventsMap, any>,
//     event: string,
//     data: any,
//     socket: AuthenticatedSocket,
//   ): Promise<void>;
// }

export interface ResEventEnvelope<T = any> {
  version: string;
  timestamp: Date;
  targetId?: string;
  payload: T;
}
