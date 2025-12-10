import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventRouterService } from '@websocket/services/event-router.service';
import {
  EventHandler,
  ResEventEnvelope,
  AuthenticatedSocket,
} from '@websocket/interfaces/websocket.interface';
import { PresenceService } from '@presence/presence.service';
import { PresenceEvents } from '../events/presence.events';
import {
  UpdatePresenceDto,
  SubscribePresenceDto,
  HeartbeatDto,
  BatchPresenceResponse,
} from '@presence/interfaces/presence.interface';

@Injectable()
export class PresenceGateway implements EventHandler, OnModuleInit {
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);
  private readonly handledEvents = Object.values(PresenceEvents);

  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly presenceService: PresenceService,
  ) {}

  onModuleInit() {
    this.handledEvents.forEach((event) => {
      this.eventRouter.registerHandler(event, this);
    });
    this.logger.log('Presence gateway registered with event router');
  }

  canHandle(event: any): boolean {
    return this.handledEvents.includes(event);
  }

  async handle(
    event: string,
    data: any,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const user = socket.user;
    if (!user) {
      this.logger.error('No user found in socket');
      return;
    }

    const userId = user.userId;
    const deviceId = user.deviceId || 'unknown';

    try {
      switch (event) {
        case PresenceEvents.UPDATE_STATUS:
          await this.handleUpdateStatus(userId, data, socket);
          break;

        case PresenceEvents.SUBSCRIBE:
          await this.handleSubscribe(userId, data, socket);
          break;

        case PresenceEvents.UNSUBSCRIBE:
          await this.handleUnsubscribe(userId, data, socket);
          break;

        case PresenceEvents.GET_SUBSCRIPTIONS:
          await this.handleGetSubscriptions(userId, socket);
          break;

        case PresenceEvents.HEARTBEAT:
          await this.handleHeartbeat(userId, deviceId, data, socket);
          break;

        // case PresenceEvents.USER_ACTIVITY:
        //   await this.handleUserActivity(userId, deviceId, socket);
        //   break;

        case PresenceEvents.GET_STATUS:
          await this.handleGetStatus(userId, data, socket);
          break;

        case PresenceEvents.GET_BATCH_STATUS:
          await this.handleGetBatchStatus(userId, data, socket);
          break;
        case PresenceEvents.SUBSCRIBE:
          await this.handleSubscribe(userId, data, socket);
          break;

        case PresenceEvents.UPDATE_STATUS:
          await this.handleUpdateStatus(userId, data, socket);
          break;

        case PresenceEvents.HEARTBEAT:
          await this.handleHeartbeat(user.userId, user.deviceId, data, socket);
          break;

        default:
          this.logger.warn(`Unhandled presence event: ${event}`);
      }
    } catch (error: any) {
      this.logger.error(`Error handling presence event ${event}:`, error);

      socket.emit(PresenceEvents.PRESENCE_ERROR, {
        event,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  // ============ Event Handlers ============

  private async handleUpdateStatus(
    userId: string,
    data: UpdatePresenceDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const deviceId = socket.user.deviceId;

    const presence = await this.presenceService.updatePresence({
      dto: { ...data },
      userId,
    });

    // Echo back to sender
    socket.emit(PresenceEvents.STATUS_UPDATED, presence);

    this.logger.debug(`User ${userId} updated status to ${data.status}`);
  }

  private async handleSubscribe(
    userId: string,
    data: SubscribePresenceDto,
    socket: Socket,
  ): Promise<void> {
    await this.presenceService.subscribeToPresence(userId, data.userIds);

    // Send current status of subscribed users
    const batchResponse = await this.presenceService.getBulkPresence(
      data.userIds,
    );

    socket.emit(PresenceEvents.SUBSCRIBED, {
      userIds: data.userIds,
      ...batchResponse,
    });

    this.logger.debug(
      `User ${userId} subscribed to ${data.userIds.length} users`,
    );
  }

  private async handleUnsubscribe(
    userId: string,
    data: SubscribePresenceDto,
    socket: Socket,
  ): Promise<void> {
    await this.presenceService.unsubscribeFromPresence(userId, data.userIds);

    socket.emit(PresenceEvents.UNSUBSCRIBED, {
      userIds: data.userIds,
      timestamp: new Date(),
    });

    this.logger.debug(
      `User ${userId} unsubscribed from ${data.userIds.length} users`,
    );
  }

  private async handleGetSubscriptions(
    userId: string,
    socket: Socket,
  ): Promise<void> {
    const subscriptions = await this.presenceService.getSubscriptions(userId);

    socket.emit(PresenceEvents.SUBSCRIPTIONS_LIST, {
      subscriptions,
      timestamp: new Date(),
    });
  }

  private async handleHeartbeat(
    userId: string,
    deviceId: string,
    data: UpdatePresenceDto,
    socket: Socket,
  ): Promise<void> {
    await this.presenceService.updatePresence({ dto: data, userId });

    // Send acknowledgment
    socket.emit(PresenceEvents.HEARTBEAT_ACK, {
      timestamp: new Date(),
      serverTime: Date.now(),
    });

    this.logger.debug(`Heartbeat from user ${userId}, device ${deviceId}`);
  }

  // private async handleUserActivity(
  //   userId: string,
  //   deviceId: string,
  //   socket: Socket,
  // ): Promise<void> {
  //   await this.presenceService.updatePresence(userId, deviceId);

  //   this.logger.debug(`User activity detected: ${userId}, device ${deviceId}`);
  // }

  private async handleGetStatus(
    userId: string,
    data: { targetId: string },
    socket: Socket,
  ): Promise<void> {
    const presence = await this.presenceService.getPresence({
      userId: data.targetId,
    });
    console.log('handleGetStatus', { presence, data });
    const envelope: ResEventEnvelope = {
      version: '1.0.0',
      timestamp: new Date(),
      targetId: data.targetId,
      payload: presence,
    };

    socket.emit(PresenceEvents.STATUS_RESPONSE, { ...envelope });
  }

  private async handleGetBatchStatus(
    userId: string,
    data: { userIds: string[] },
    socket: Socket,
  ): Promise<void> {
    const batchResponse = await this.presenceService.getBulkPresence(
      data.userIds,
    );

    socket.emit(PresenceEvents.BATCH_STATUS_RESPONSE, batchResponse);

    this.logger.debug(
      `Sent batch status for ${data.userIds.length} users to ${userId}`,
    );
  }

  // ============ Helper Methods ============

  /**
   * Called by main gateway when user connects
   */
  async handleUserConnected(
    userId: string,
    deviceId: string,
    sessionId: string,
    socket: Socket,
  ): Promise<void> {
    const presence = await this.presenceService.setOnline(
      userId,
      deviceId,
      sessionId,
      (socket as any).user.deviceInfo,
    );

    // Notify the user they're online
    socket.emit(PresenceEvents.USER_ONLINE, presence);

    this.logger.log(`User ${userId} connected via device ${deviceId}`);
  }

  /**
   * Called by main gateway when user disconnects
   */
  async handleUserDisconnected(
    userId: string,
    deviceId: string,
  ): Promise<void> {
    const presence = await this.presenceService.setOffline(userId, deviceId);

    this.logger.log(`User ${userId} disconnected from device ${deviceId}`);
  }

  /**
   * Broadcast presence update to all interested parties
   */
  async broadcastPresenceUpdate(
    userId: string,
    status: string,
    data?: any,
  ): Promise<void> {
    this.server.emit(PresenceEvents.STATUS_CHANGE, {
      userId,
      status,
      ...data,
      timestamp: new Date(),
    });
  }
}
