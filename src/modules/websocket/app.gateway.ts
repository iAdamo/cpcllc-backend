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
import { Logger, UseGuards, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SocketEvents, EventEnvelope } from './socket.events';
import { AuthenticatedSocket } from './interfaces/websocket.interface';
import { EventRouterService } from './event-router.service';
import { SocketManagerService } from './socket-manager.service';
import { SocketValidationPipe } from './socket-validation.pipe';
import { RateLimiterService } from './rate-limiter.service';
import { ConfigService } from '@nestjs/config';

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
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
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
    server.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });
  }
  //  try {
  //       const token =
  //         client.handshake?.auth?.token ||
  //         client.handshake?.headers?.authorization?.split(' ')[1];
  //       if (!token) {
  //         this.logger.error(`Client connection rejected: No token provided`);
  //         client.disconnect();
  //         return;
  //       }

  //       const payload = jwt.verify(
  //         token,
  //         this.configService.get('JWT_SECRET') || process.env.JWT_SECRET,
  //       ) as {
  //         sub: string;
  //         email: string;
  //       };
  //       client.userId = new Types.ObjectId(payload.sub);
  //       const userId = client.userId?.toString();
  //       if (!userId) {
  //         client.disconnect();
  //         return;
  //       }
  //       // Join room for user-specific notifications
  //       const userIdStr = userId.toString();
  //       client.join(`user:${userIdStr}`);

  //       if (!this.connectedClients.has(userIdStr))
  //         this.connectedClients.set(userIdStr, new Set());

  //       this.connectedClients.get(userIdStr).add(client);

  //       this.logger.log(`Client connected: ${client.id} for user ${userIdStr}`);
  //       this.logger.debug(
  //         `Total connected clients: ${this.connectedClients.size}`,
  //       );
  //     } catch (error: any) {
  //       this.logger.error(
  //         `Authentication failed for client ${client.id}: ${error.message}`,
  //       );
  //       client.disconnect();
  //     }
  //   }

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
      client.user.userId = payload.sub;
      const userId = client.user.userId?.toString();
      if (!userId) {
        client.disconnect();
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

      this.logger.log(
        `Client connected: ${client.id}, User: ${userId}, Device: ${payload.deviceId}`,
      );

      // Notify presence system
      client.emit(SocketEvents.CONNECTION, {
        status: 'connected',
        socketId: client.id,
        timestamp: Date.now(),
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
      await this.socketManager.removeUserSession(client.id);
      this.logger.log(`Client disconnected: ${client.id}`);
    } catch (error) {
      this.logger.error('Disconnection handling failed:', error);
    }
  }

  /**
   * Global message handler - routes all events through the event router
   */
  @SubscribeMessage('*')
  async handleAllEvents(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: EventEnvelope,
  ) {
    const event = data.event;

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

      // Update last seen
      await this.socketManager.updateLastSeen(
        client.user.userId,
        client.user.deviceId,
      );

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
    const sockets = await this.socketManager.getUserSockets(userId);

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit(event, data);
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
