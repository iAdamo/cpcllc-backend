import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Presence } from './schemas/presence.schema';
import {
  UpdatePresenceDto,
  PresenceResponse,
  BatchPresenceResponse,
  PresenceStats,
  PRESENCE_STATUS,
  PRESENCE_CONFIG,
  PresenceStatus,
} from './interfaces/presence.interface';
import { PresenceEvents } from '@websocket/events/presence.events';
import { SocketManagerService } from '@websocket/services/socket-manager.service';
import {
  AuthUser,
  EventHandlerContext,
  UserSession,
} from '@websocket/interfaces/websocket.interface';
import { NotificationService } from '@notification/services/notification.service';
import {
  CreateNotificationDto,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  ActionType,
} from '@notification/interfaces/notification.interface';

@Injectable()
export class PresenceService implements OnModuleInit {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @InjectModel(Presence.name)
    private readonly presenceModel: Model<Presence>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly socketManager: SocketManagerService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.initializePresenceSystem();
  }

  private async initializePresenceSystem(): Promise<void> {
    // Clean up any stale presence data on startup
    await this.cleanupStalePresence();
    this.logger.log('Presence system initialized');
  }

  /**
   * Health check
   * @returns
   */
  async check() {
    const mongoStatus = this.mongoConnection.readyState === 1 ? 'up' : 'down';

    let redisStatus = 'down';
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') redisStatus = 'up';
    } catch (_) {}

    return {
      status: mongoStatus === 'up' && redisStatus === 'up' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: mongoStatus,
        redis: redisStatus,
      },
    };
  }

  /**
   * Update user presence status
   */
  async updatePresence({
    dto,
    userId,
    session,
    socket,
    server,
  }: {
    dto: UpdatePresenceDto;
    userId?: string;
    session?: UserSession;
    socket?: AuthUser;
    server?: EventHandlerContext['server'];
  }): Promise<PresenceResponse> {
    const now = new Date();
    const id = userId || session.userId;

    if (dto.state) dto.metadata = { state: dto.state };
    // console.log({ dto, userId, session, socket });
    const presence = await this.presenceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(id) },
      {
        status: dto.status,
        customStatus: dto.customStatus,
        lastSeen: dto.lastSeen,
        deviceId: session?.deviceId || socket?.user?.deviceId || '',
        sessionId: session?.sessionId || socket?.user?.sessionId || '',
        updatedAt: now,
        metadata: dto.metadata,
      },
      { new: true, upsert: true },
    );
    if (!session && !socket) {
      console.debug('no session and socket');
      return;
    }
    // Update sessions in SocketManager
    await this.socketManager.updateSession({
      userId: id,
      deviceId: session?.deviceId ? session.deviceId : socket?.user?.deviceId,
      updates: {
        status: dto.status,
        customStatus: dto.customStatus,
        lastSeen: new Date(dto.lastSeen),
        metadata: dto.metadata,
      },
    });
    if (server) await this.notifyStatusChange(server, id);

    this.logger.debug(`Updated presence for user ${id}: ${dto.status}`);

    return this.toResponse(presence);
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  /**
   * Subscribe to presence updates of other users
   */
  async subscribeToPresence(
    server: EventHandlerContext['server'],
    subscriberId: string,
    targetId: string,
    response?: {
      providerId: string;
      userId: string;
      userName: string;
      userImage: string;
      followersCount: number;
      isFollowing: boolean;
      followedBy: string[];
    },
  ): Promise<void> {
    // const presence = await this.getPresence({
    //   userId: subscriberId,
    // });
    if (subscriberId === targetId) return;

    if (subscriberId && targetId) {
      const subscriptionKey = this.getSubscriptionKey(subscriberId);
      await this.redis.sadd(subscriptionKey, targetId);

      const subscriberKey = this.getSubscriberKey(targetId);
      await this.redis.sadd(subscriberKey, subscriberId);

      // const afterSubscriptions = await this.redis.smembers(subscriptionKey);
      // const afterSubscribers = await this.redis.smembers(subscriberKey);

      // console.log({ afterSubscriptions, afterSubscribers });
    } else {
      this.logger.error(
        'Presence error: subscriberId or targetId is undefined',
      );
      return;
    }

    await this.socketManager.sendToUser({
      userId: subscriberId,
      event: PresenceEvents.SUBSCRIBED,
      data: response,
      server,
    });

    await this.socketManager.sendToUser({
      userId: targetId,
      event: PresenceEvents.SUBSCRIBED,
      data: response,
      server,
    });

    const notifData: CreateNotificationDto = {
      userId: targetId,
      title: 'You have a new follower',
      body: `${response.userName}`,
      metadata: { thumbnail: response.userImage },
      category: NotificationCategory.FRIEND_REQUEST,
      priority: NotificationPriority.NORMAL,
      channels: [NotificationChannel.PUSH],
      actionType: ActionType.VIEW_PROFILE,
      // actionUrl: chatId,
    };

    await this.notificationService.create(notifData);
    this.logger.debug(`User ${subscriberId} subscribed to ${targetId} users`);
  }

  /**
   * Unsubscribe from presence updates
   */
  async unsubscribeFromPresence(
    server: EventHandlerContext['server'],
    subscriberId: string,
    targetId: string,
    response?: {
      providerId: string;
      userId: string;
      userName: string;
      userImage: string;
      followersCount: number;
      isFollowing: boolean;
      followedBy: string[];
    },
  ): Promise<void> {
    // const presence = await this.getPresence({
    //   userId: subscriberId,
    // });
    const subscriptionKey = this.getSubscriptionKey(subscriberId);
    await this.redis.srem(subscriptionKey, targetId);

    const subscriberKey = this.getSubscriberKey(targetId);
    await this.redis.srem(subscriberKey, subscriberId);
    await this.socketManager.sendToUser({
      userId: subscriberId,
      event: PresenceEvents.SUBSCRIBED,
      data: response,
      server,
    });

    await this.socketManager.sendToUser({
      userId: targetId,
      event: PresenceEvents.SUBSCRIBED,
      data: response,
      server,
    });

    this.logger.debug(
      `User ${subscriberId} unsubscribed from ${targetId} users`,
    );
  }

  /**
   * Get list of users subscribed to
   */
  async getSubscriptions(userId: string): Promise<string[]> {
    const subscriptionKey = this.getSubscriptionKey(userId);
    return await this.redis.smembers(subscriptionKey);
  }

  /**
   * Get list of users who are subscribed to this user
   */
  async getSubscribers(userId: string): Promise<string[]> {
    const subscriberKey = this.getSubscriberKey(userId);
    return await this.redis.smembers(subscriberKey);
  }

  // ==================== STATUS QUERIES ====================

  /**
   * Get user presence status
   */
  async getPresence({
    userId,
    status,
  }: {
    userId: string;
    status?: PRESENCE_STATUS[];
  }): Promise<any> {
    const sessions = await this.socketManager.getUserSessions({
      userId,
      status,
    });
    // console.log(`sessions for target ${userId}`, { sessions });
    if (sessions.length > 0 && sessions[0].customStatus) {
      const data = sessions[0];
      return {
        userId: userId,
        status: data.status,
        isOnline: (data.status && data.customStatus) === 'online',
        lastSeen: new Date(data.lastSeen),
        deviceId: data.deviceId,
        sessionId: data.sessionId,
        customStatus: data.customStatus,
        connectedAt: data.connectedAt,
        metadata: data.metadata,
      };
    }

    // Fallback to MongoDB
    const presence = await this.presenceModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    // console.log(`presence for target ${userId}`, { presence });

    return presence ? this.toResponse(presence) : null;
  }

  /**
   * Get batch presence status for multiple users
   */
  async getBulkPresence(userIds: string[]): Promise<BatchPresenceResponse> {
    const presences: PresenceResponse[] = [];

    for (const userId of userIds) {
      const presence = await this.getPresence({ userId });

      if (presence) presences.push(presence);
    }
    return {
      presences,
      timestamp: new Date(),
    };
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const deviceKeys = await this.redis.keys(this.getRedisKey(userId, '*'));
    return deviceKeys.length > 0;
  }

  /**
   * Get user status (online/offline/away/busy)
   */
  async getUserStatus(userId: string): Promise<PresenceStatus> {
    const presence = await this.getPresence({ userId });
    return presence?.status || PRESENCE_STATUS.OFFLINE;
  }

  // ==================== SYSTEM METHODS ====================

  /**
   * Cron job to detect inactive users and mark them as away
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkInactiveUsers(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = PRESENCE_CONFIG.INACTIVE_THRESHOLD;

    // Get all user sessions across all users
    const allSessions = await this.socketManager.getUserSessions({
      status: [PRESENCE_STATUS.ONLINE],
    });

    // console.log({ allSessions });

    // Check for inactivity
    for (const session of allSessions) {
      const lastSeen = new Date(session.lastSeen);
      const timeDiff = now.getTime() - lastSeen.getTime();

      if (timeDiff > inactiveThreshold) {
        // Mark the user as away
        await this.updatePresence({
          dto: { status: PRESENCE_STATUS.AWAY, lastSeen: Date.now() },
          session,
        });
      }
    }
  }

  /**
   * Get presence statistics
   */
  async getPresenceStats(): Promise<PresenceStats> {
    const totalUsers = await this.presenceModel.countDocuments();
    const onlineUsers = await this.presenceModel.countDocuments({
      status: PRESENCE_STATUS.ONLINE,
    });
    const awayUsers = await this.presenceModel.countDocuments({
      status: PRESENCE_STATUS.AWAY,
    });
    const busyUsers = await this.presenceModel.countDocuments({
      status: PRESENCE_STATUS.BUSY,
    });

    // Get peak concurrent from Redis (simplified)
    const onlineKeys = await this.redis.keys('presence:*:*');
    const currentOnline = new Set();

    for (const key of onlineKeys) {
      const userId = key.split(':')[1];
      currentOnline.add(userId);
    }

    return {
      totalUsers,
      onlineUsers,
      awayUsers,
      busyUsers,
      peakConcurrent: currentOnline.size,
    };
  }

  async handleDisconnect(
    server: EventHandlerContext['server'],
    client: AuthUser,
  ) {
    try {
      await this.updatePresence({
        dto: {
          status: PRESENCE_STATUS.OFFLINE,
          lastSeen: Date.now(),
        },
        userId: client.user.userId,
        socket: client,
        server,
      });

      await this.socketManager.removeUserSession(client.id);
    } catch (e) {
      this.logger.error('Disconnect handling failed', e);
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private async hasActiveDevices(
    userId: string,
    excludeDeviceId?: string,
  ): Promise<boolean> {
    const deviceKeys = await this.redis.keys(this.getRedisKey(userId, '*'));

    if (deviceKeys.length === 0) return false;

    if (!excludeDeviceId) return true;

    // Check if there are other active devices
    for (const key of deviceKeys) {
      const deviceId = key.split(':')[2];
      if (deviceId !== excludeDeviceId) {
        return true;
      }
    }

    return false;
  }

  private async notifyStatusChange(
    server: EventHandlerContext['server'],
    userId: string,
  ): Promise<void> {
    const subscribers = await this.getSubscribers(userId);
    const presence = await this.getPresence({ userId });

    // console.log({ subscribers });

    for (const subscriberId of subscribers) {
      if (presence) {
        await this.socketManager.sendToUser({
          server,
          userId: subscriberId,
          event: PresenceEvents.STATUS_CHANGE,
          data: this.toResponse(presence),
        });
      }
    }
  }

  private getStatusEvent(status: PresenceStatus): string {
    switch (status) {
      case PRESENCE_STATUS.ONLINE:
        return PresenceEvents.USER_ONLINE;
      case PRESENCE_STATUS.OFFLINE:
        return PresenceEvents.USER_OFFLINE;
      case PRESENCE_STATUS.AWAY:
        return PresenceEvents.USER_AWAY;
      case PRESENCE_STATUS.BUSY:
        return PresenceEvents.USER_BUSY;
      case PRESENCE_STATUS.DO_NOT_DISTURB:
        return PresenceEvents.STATUS_CHANGE;
      default:
        return PresenceEvents.STATUS_CHANGE;
    }
  }

  private async cleanupStalePresence(): Promise<void> {
    // Clean up Redis keys that have expired
    // Redis handles TTL automatically, but we can do additional cleanup
    const staleThreshold = Date.now() - PRESENCE_CONFIG.OFFLINE_THRESHOLD;

    const result = await this.presenceModel.updateMany(
      {
        status: { $ne: PRESENCE_STATUS.OFFLINE },
        lastSeen: { $lt: new Date(staleThreshold) },
      },
      {
        status: PRESENCE_STATUS.OFFLINE,
        updatedAt: new Date(),
      },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Cleaned up ${result.modifiedCount} stale presence records`,
      );
    }
  }

  private getRedisKey(userId: string, deviceId: string): string {
    return `presence:${userId}:${deviceId}`;
  }

  private getSubscriptionKey(userId: string): string {
    return `presence:subscriptions:${userId}`;
  }

  private getSubscriberKey(userId: string): string {
    return `presence:subscribers:${userId}`;
  }

  private toResponse(presence: Presence): PresenceResponse {
    return {
      userId: presence.userId.toString(),
      status: presence.status as PresenceStatus,
      isOnline: presence.status === PRESENCE_STATUS.ONLINE,
      lastSeen: presence.lastSeen,
      deviceId: presence.deviceId,
      // sessionId: presence.sessionId,
      customStatus: presence.customStatus,
      // expiresAt: presence.expiresAt,
      // metadata: presence.metadata,
    };
  }
}
