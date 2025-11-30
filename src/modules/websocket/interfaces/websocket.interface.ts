import { Socket } from 'socket.io';

/**
 * Extended Socket interface with user context
 */
export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    email: string;
    roles: string[];
    deviceId: string;
    sessionId: string;
  };
}

/**
 * User session information
 */
export interface UserSession {
  userId: string;
  socketId: string;
  deviceId: string;
  sessionId: string;
  connectedAt: Date;
  lastSeen: Date;
  isOnline: boolean;
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

/**
 * Event handler interface for module gateways
 */
export interface EventHandler {
  canHandle(event: string): boolean;
  handle(event: string, data: any, socket: AuthenticatedSocket): Promise<void>;
}
