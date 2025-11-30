import { WsJwtGuard } from '@modules/jwt/jwt.guard';
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

  /**
   * Handle new client connections
   */
  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const { userId, deviceId, sessionId } = client.user;

      // Register user session
      await this.socketManager.addUserSession(
        userId,
        client.id,
        deviceId,
        sessionId,
      );

      this.logger.log(
        `Client connected: ${client.id}, User: ${userId}, Device: ${deviceId}`,
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
