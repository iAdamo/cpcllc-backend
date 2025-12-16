import { Logger, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventRouterService } from '@websocket/services/event-router.service';
import {
  EventHandler,
  ResEventEnvelope,
  AuthenticatedSocket,
  EventHandlerContext,
} from '@websocket/interfaces/websocket.interface';
import { PresenceService } from '@presence/presence.service';
import { PresenceEvents } from '../events/presence.events';
import {
  UpdatePresenceDto,
  SubscribePresenceDto,
} from '@presence/interfaces/presence.interface';
import { UsersService } from '@users/users.service';
import { SocketManagerService } from '@websocket/services/socket-manager.service';

@WebSocketGateway()
export class PresenceGateway implements EventHandler {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);
  private readonly handledEvents = Object.values(PresenceEvents);

  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly presenceService: PresenceService,
    private readonly userService: UsersService,
    private readonly socketManager: SocketManagerService,
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

  async handle({
    server,
    event,
    data,
    socket,
  }: EventHandlerContext): Promise<void> {
    const user = socket.user;
    if (!user) {
      this.logger.error('No user found in socket');
      return;
    }

    const userId = user.userId;
    const deviceId = user.deviceId;

    try {
      switch (event) {
        case PresenceEvents.UPDATE_STATUS:
          await this.handleUpdateStatus(server, userId, data, socket);
          break;

        case PresenceEvents.SUBSCRIBE:
          await this.handleSubscribe(server, userId, data, socket);
          break;

        // case PresenceEvents.UNSUBSCRIBE:
        //   await this.handleUnsubscribe(userId, data, socket);
        //   break;

        case PresenceEvents.GET_SUBSCRIPTIONS:
          await this.handleGetSubscriptions(server, userId, data, socket);
          break;

        case PresenceEvents.HEARTBEAT:
          await this.handleHeartbeat(userId, deviceId, data, socket, server);
          break;

        case PresenceEvents.USER_ACTIVITY:
          await this.handleUserActivity(server, userId, deviceId, data, socket);
          break;

        case PresenceEvents.GET_STATUS:
          await this.handleGetStatus(userId, data, socket);
          break;

        case PresenceEvents.GET_BATCH_STATUS:
          await this.handleGetBatchStatus(userId, data, socket);
          break;

        case PresenceEvents.SUBSCRIBE:
          await this.handleSubscribe(server, userId, data, socket);
          break;

        case PresenceEvents.UPDATE_STATUS:
          await this.handleUpdateStatus(server, userId, data, socket);
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
    server: EventHandlerContext['server'],
    userId: string,
    data: UpdatePresenceDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const deviceId = socket.user.deviceId;
    const presence = await this.presenceService.updatePresence({
      dto: { ...data },
      userId,
      socket,
      server,
    });

    // Echo back to sender
    this.socketManager.sendToUser({
      server,
      userId,
      event: PresenceEvents.STATUS_UPDATED,
      data: presence,
    });
    socket.emit(PresenceEvents.STATUS_UPDATED, presence);

    this.logger.debug(`User ${userId} updated status to ${data.status}`);
  }

  private async handleSubscribe(
    server: EventHandlerContext['server'],
    userId: string,
    data: SubscribePresenceDto,
    socket: Socket,
  ): Promise<void> {
    const response = await this.userService.toggleFollowProvider(
      userId,
      data.userIds[0],
    );
    // console.log({ userId, data });
    if (!response.isFollowing) {
      this.handleUnsubscribe(userId, data, socket);
    } else {
      await this.presenceService.subscribeToPresence(
        server,
        userId,
        data.userIds,
      );
    }
    // Send current status of subscribed users
    const batchResponse = await this.presenceService.getBulkPresence(
      data.userIds,
    );

    socket.emit(PresenceEvents.SUBSCRIBED, {
      ...response,
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
  }

  private async handleGetSubscriptions(
    server: EventHandlerContext['server'],
    userId: string,
    data: any,
    socket: Socket,
  ): Promise<void> {
    let subscriptions = [] as string[];
    let subscribers = [] as string[];
    let payload = [] as string[];

    const user = await this.userService.userProfile(data.userIds[0]);

    // for (const subscriber of subscribers) {
    //   users.push(subscriber);
    // }
    const hhh = {
      providerId: user.activeRoleId.toString(),
      // followersCount: number;
      // isFollowing: boolean;
      // followedBy: string[];
    };

    this.socketManager.sendToUser({
      server,
      userId,
      event: PresenceEvents.SUBSCRIBED,
      data: payload,
    });
    socket.emit(PresenceEvents.SUBSCRIPTIONS_LIST, {
      subscriptions,
      timestamp: new Date(),
    });
  }

  private async handleHeartbeat(
    userId: string,
    deviceId: string,
    data: UpdatePresenceDto,
    socket: AuthenticatedSocket,
    server: EventHandlerContext['server'],
  ): Promise<void> {
    await this.presenceService.updatePresence({
      server,
      dto: data,
      userId,
      socket,
    });

    // Send acknowledgment
    socket.emit(PresenceEvents.HEARTBEAT_ACK, {
      timestamp: new Date(),
      serverTime: Date.now(),
    });

    this.logger.debug(`Heartbeat from user ${userId}, device ${deviceId}`);
  }

  private async handleUserActivity(
    server: EventHandlerContext['server'],
    userId: string,
    deviceId: string,
    data: UpdatePresenceDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    await this.presenceService.updatePresence({
      dto: data,
      userId,
      socket,
      server,
    });

    this.logger.debug(`User activity detected: ${userId}, device ${deviceId}`);
  }

  private async handleGetStatus(
    userId: string,
    data: { targetId: string },
    socket: Socket,
  ): Promise<void> {
    const presence = await this.presenceService.getPresence({
      userId: data.targetId,
    });
    // console.log({ presence });
    const envelope: ResEventEnvelope = {
      version: '1.0.0',
      timestamp: new Date(),
      targetId: data.targetId,
      payload: { ...presence },
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
