import { WsJwtGuard } from '@modules/jwt/jwt.guard';
import * as jwt from 'jsonwebtoken';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SocketEvents, EventEnvelope } from '../events/socket.events';
import { AuthenticatedSocket } from '../interfaces/websocket.interface';
import { EventRouterService } from '../services/event-router.service';
import { SocketManagerService } from '../services/socket-manager.service';
import { SocketValidationPipe } from '../socket-validation.pipe';
import { RateLimiterService } from '../services/rate-limiter.service';
import { ConfigService } from '@nestjs/config';
import { PresenceEvents } from '@websocket/events/presence.events';
import { PRESENCE_STATUS } from '@presence/constants/presence.constants';
import { PresenceService } from '@presence/presence.service';
import { ResEventEnvelope } from '../interfaces/websocket.interface';

/**
 * Main WebSocket Gateway - Single entry point for all WebSocket communications
 * Handles connection lifecycle, authentication, routing, and rate limiting
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 120000,
  pingInterval: 60000,
})
@UseGuards(WsJwtGuard)
@UsePipes(new SocketValidationPipe())
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly socketManager: SocketManagerService,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * After gateway initialization
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Handle server-level errors
    server.on('error', (error, socket) => {
      socket.onAny((event: any, ...args: any[]) => {
        console.log(`[GLOBAL] Event: ${event}`, args);
      });
      if (error) this.logger.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle new client connections
   */
  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake?.auth?.token ||
        client.handshake?.headers?.authorization?.split(' ')[1];
      if (!token) {
        this.logger.error(`Client connection rejected: No token provided`);
        client.disconnect();
        return;
      }
      const payload = jwt.verify(
        token,
        this.configService.get('JWT_SECRET') || process.env.JWT_SECRET,
      ) as {
        sub: string;
        email: string;
        phoneNumber?: string;
        roles: 'Client' | 'Provider' | 'Admin';
        deviceId: string;
        sessionId: string;
      };
      client.user = {} as any;
      const { sub, ...rest } = payload;
      client.user = { ...rest, userId: sub };
      const userId = client.user.userId?.toString();
      if (!userId) {
        client.disconnect(true);
        return;
      }
      // const userIdStr = userId.toString();
      // client.join(`user:${userIdStr}`);

      // Register user session
      await this.socketManager.addUserSession(
        userId,
        client.id,
        payload.deviceId,
        payload.sessionId,
      );

      // Update last seen
      await this.socketManager.updateSession({
        userId: client.user.userId,
        deviceId: client.user.deviceId,
        updates: { lastSeen: new Date(), status: PRESENCE_STATUS.ONLINE },
      });

      // Notify presence system
      client.emit(SocketEvents.CONNECTION, {
        status: client.connected && 'connected',
        socketId: client.id,
        timestamp: Date.now(),
      });

      client.onAny(async (event, ...args) => {
        this.logger.log(
          `WS Event Received | User: ${client.user.userId} | Event: ${event}`,
        );
        const payload = JSON.stringify(args);
        const data = JSON.parse(payload);

        await this.handleAllEvents(client, event, data[0]);
      });
    } catch (error) {
      this.logger.error('Connection handling failed:', error);
      client.disconnect(true);
    }
  }

  /**
   * Handle client disconnections
   */
  async handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      // Update last seen
      await this.socketManager.updateSession({
        userId: client.user.userId,
        deviceId: client.user.deviceId,
        updates: { lastSeen: new Date(), status: PRESENCE_STATUS.OFFLINE },
      });
      await this.socketManager.removeUserSession(client.id);
    } catch (error) {
      this.logger.error('Disconnection handling failed:', error);
    }
  }

  /**
   * Global message handler - routes all events through the event router
   */
  async handleAllEvents(
    @ConnectedSocket() client: AuthenticatedSocket,
    event: string,
    @MessageBody() data: any,
  ) {
    try {
      // Rate limiting check
      const rateLimit = await this.rateLimiter.isAllowed(
        client.user.userId,
        event,
        client.id,
      );

      if (!rateLimit.allowed) {
        client.emit(SocketEvents.RATE_LIMIT_EXCEEDED, {
          event,
          remaining: rateLimit.remaining,
          resetTime: rateLimit.resetTime,
        });
        this.logger.warn(
          `Rate limit exceeded for user ${client.user.userId}, event: ${event}`,
        );
        return;
      }
      // Route event to appropriate module handler
      await this.eventRouter.route(event, data, client);
    } catch (error: any) {
      this.logger.error(`Error handling event ${event}:`, error);

      client.emit(SocketEvents.ERROR, {
        error: 'EVENT_HANDLING_ERROR',
        message: error.message,
        event,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.server.emit(event, data);
  }

  /**
   * Send to specific user across all devices
   */
  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    const sockets = await this.socketManager.getUserSockets({ userId });

    const envelope: ResEventEnvelope = {
      version: '1.0.0',
      timestamp: new Date(),
      targetId: data.targetId,
      payload: data,
    };

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit(event, { ...envelope });
    });
  }

  /**
   * Send to specific room
   */
  sendToRoom(room: string, event: string, data: any): void {
    this.server.to(room).emit(event, data);
  }

  /**
   * Get connected clients count
   */
  getConnectedClients(): number {
    return this.server.engine.clientsCount;
  }
}
