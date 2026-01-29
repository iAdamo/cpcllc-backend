import { Logger, Injectable, OnModuleInit } from '@nestjs/common';
import {
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventRouterService } from '@websocket/services/event-router.service';
import {
  EventHandler,
  EventHandlerContext,
} from '@websocket/interfaces/websocket.interface';
import { NotificationService } from '../../notification/services/notification.service';
import { PreferenceService } from '../../notification/services/preference.service';
// import { NotificationEvents } from '../../notification/constants/notification.constants';
import { NotificationEvents } from '../events/notification.events';
import {
  CreateNotificationDto,
  CreateBulkNotificationDto,
  FilterNotificationsDto,
} from '../../notification/interfaces/notification.interface';
import {
  UpdatePreferenceDto,
  UpdatePushTokenDto,
} from '../../notification/interfaces/preference.interface';

@Injectable()
export class NotificationGateway implements EventHandler, OnModuleInit {
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly handledEvents = Object.values(NotificationEvents);

  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly notificationService: NotificationService,
    private readonly preferenceService: PreferenceService,
  ) {}

  onModuleInit() {
    this.handledEvents.forEach((event) => {
      this.eventRouter.registerHandler(event, this);
    });
    this.logger.log('Notification gateway registered');
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
    const userId = (socket as any).user?.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      switch (event) {
        case NotificationEvents.SEND_NOTIFICATION:
          await this.handleSendNotification(userId, data, socket);
          break;

        case NotificationEvents.SEND_BULK_NOTIFICATION:
          await this.handleSendBulkNotification(userId, data, socket);
          break;

        case NotificationEvents.MARK_AS_READ:
          await this.handleMarkAsRead(userId, data, socket);
          break;

        case NotificationEvents.GET_NOTIFICATIONS:
          await this.handleGetNotifications(userId, data, socket);
          break;

        case NotificationEvents.GET_UNREAD_COUNT:
          await this.handleGetUnreadCount(userId, data, socket);
          break;

        case NotificationEvents.UPDATE_PREFERENCE:
          await this.handleUpdatePreference(userId, data, socket);
          break;

        case NotificationEvents.UPDATE_PUSH_TOKEN:
          await this.handleUpdatePushToken(userId, data, socket);
          break;

        case NotificationEvents.GET_PREFERENCE:
          await this.handleGetPreference(userId, socket);
          break;
      }
    } catch (error: any) {
      this.logger.error(`Error handling ${event}:`, error);
      socket.emit('error', {
        event,
        error: error.message,
      });
    }
  }

  @SubscribeMessage(NotificationEvents.NOTIFICATION_RECEIVED)
  async handleIncomingNotification(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    // This handles real-time in-app notifications
    const userId = (socket as any).user?.id;
    socket.emit(NotificationEvents.NOTIFICATION_RECEIVED, data);
  }

  private async handleSendNotification(
    userId: string,
    data: CreateNotificationDto,
    socket: Socket,
  ): Promise<void> {
    const notification = await this.notificationService.create(data);

    if (data.userId === userId) {
      socket.emit(NotificationEvents.NOTIFICATION_RECEIVED, notification);
    }
  }

  private async handleSendBulkNotification(
    userId: string,
    data: CreateBulkNotificationDto,
    socket: Socket,
  ): Promise<void> {
    const result = await this.notificationService.createBulk(data);
    socket.emit(NotificationEvents.BULK_NOTIFICATION_RESULT, result);
  }

  private async handleMarkAsRead(
    userId: string,
    data: { notificationIds: string[] },
    socket: Socket,
  ): Promise<void> {
    await this.notificationService.markAsRead(userId, data.notificationIds);
    socket.emit(NotificationEvents.NOTIFICATION_READ, {
      notificationIds: data.notificationIds,
      readAt: new Date(),
    });
  }

  private async handleGetNotifications(
    userId: string,
    data: FilterNotificationsDto,
    socket: Socket,
  ): Promise<void> {
    const notifications = await this.notificationService.findByUser({
      ...data,
      userId,
    });
    socket.emit(NotificationEvents.NOTIFICATIONS_FETCHED, notifications);
  }

  private async handleGetUnreadCount(
    userId: string,
    data: { tenantId?: string },
    socket: Socket,
  ): Promise<void> {
    const count = await this.notificationService.getUnreadCount(
      userId,
      data?.tenantId,
    );
    socket.emit(NotificationEvents.UNREAD_COUNT, { count });
  }

  private async handleUpdatePreference(
    userId: string,
    data: UpdatePreferenceDto,
    socket: Socket,
  ): Promise<void> {
    const preference = await this.preferenceService.update(userId, data);
    socket.emit(NotificationEvents.PREFERENCE_UPDATED, preference);
  }

  private async handleUpdatePushToken(
    userId: string,
    data: UpdatePushTokenDto,
    socket: Socket,
  ): Promise<void> {
    await this.preferenceService.updatePushToken(userId, data);
    socket.emit(NotificationEvents.PUSH_TOKEN_UPDATED, { success: true });
  }

  private async handleGetPreference(
    userId: string,
    socket: Socket,
  ): Promise<void> {
    const preference = await this.preferenceService.getOrCreate(userId);
    socket.emit(NotificationEvents.PREFERENCE_FETCHED, preference);
  }

  // Helper method to send real-time notifications
  async sendRealTimeNotification(
    userId: string,
    notification: any,
  ): Promise<void> {
    this.server
      .to(`user:${userId}`)
      .emit(NotificationEvents.NOTIFICATION_RECEIVED, notification);
  }
}
