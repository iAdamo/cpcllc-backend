import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from '@modules/jwt/jwt.guard';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotificationService } from '../notification.service';

interface AuthenticatedSocket extends Socket {
  userId: Types.ObjectId;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'notification',
  path: '/sanuxsocket/socket.io',
})
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  // private readonly connectedClients = new Map<string, Set<Socket>>();
  private readonly connectedClients: Map<string, Set<Socket>> = new Map();

  constructor(
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { notificationId } = data;
    const userId = client.userId;

    this.logger.log(
      `User ${userId} marked notification ${notificationId} as read`,
    );

    // Acknowledge the action
    client.emit('notification_marked_read', { notificationId, success: true });
  }

  @SubscribeMessage('subscribe_to_category')
  async handleSubscribeToCategory(
    @MessageBody() data: { category: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const { category } = data;
    const userId = client.userId;

    // Join category-specific room
    client.join(`category:${category}`);

    this.logger.log(`User ${userId} subscribed to category ${category}`);
    client.emit('subscription_confirmed', { category, success: true });
  }

  // Method to emit notifications to specific user
  async emitToUser(
    userId: string,
    event: string,
    payload: any,
  ): Promise<boolean> {
    const client = this.connectedClients.get(userId);
    if (client && (client as any).connected) {
      (client as any).emit(event, payload);
      this.logger.debug(`Emitted ${event} to user ${userId}`);
      return true;
    }

    this.logger.debug(`User ${userId} is not connected, cannot emit ${event}`);
    return false;
  }

  // Method to broadcast to all connected clients
  async broadcast(event: string, payload: any): Promise<void> {
    this.server.emit(event, payload);
    this.logger.debug(`Broadcasted ${event} to all connected clients`);
  }

  // Method to emit to users in a specific tenant
  async emitToTenant(
    tenantId: string,
    event: string,
    payload: any,
  ): Promise<void> {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
    this.logger.debug(`Emitted ${event} to tenant ${tenantId}`);
  }
}
