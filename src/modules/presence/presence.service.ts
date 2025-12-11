import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Presence } from './schemas/presence.schema';
import {
  UpdatePresenceDto,
  SubscribePresenceDto,
  PresenceResponse,
  BatchPresenceResponse,
  PresenceStats,
  HeartbeatDto,
  DeviceInfo,
  PRESENCE_STATUS,
  PRESENCE_CONFIG,
  PresenceStatus,
} from './interfaces/presence.interface';
import { PresenceEvents } from '@websocket/events/presence.events';
import { SocketManagerService } from '@websocket/services/socket-manager.service';
import { AppGateway } from '@websocket/gateways/app.gateway';
import {
  AuthenticatedSocket,
  UserSession,
} from '@websocket/interfaces/websocket.interface';
import { PresenceGateway } from '@websocket/gateways/presence.gateway';

@Injectable()
export class PresenceService implements OnModuleInit {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    @InjectModel(Presence.name)
    private readonly presenceModel: Model<Presence>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly appGateway: AppGateway,
    private readonly socketManager: SocketManagerService,
    // private readonly sr: ChatGateway,
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
   * Update user presence status
   */
  async updatePresence({
    dto,
    userId,
    session,
    socket,
  }: {
    dto: UpdatePresenceDto;
    userId?: string;
    session?: UserSession;
    socket?: AuthenticatedSocket;
  }): Promise<Presence> {
    const now = new Date();
    const id = userId || session.userId;

    if (dto.state) dto.metadata = { state: dto.state };

    const presence = await this.presenceModel.findOneAndUpdate(
      { userId: new Types.ObjectId(id) },
      {
        status: dto.status,
        customStatus: dto.customStatus,
        lastSeen: dto.timestamp || now,
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
      deviceId: session?.deviceId ? session.deviceId : socket.user.deviceId,
      updates: {
        status: dto.status,
        customStatus: dto.customStatus,
        lastSeen: now,
        metadata: dto.metadata,
      },
    });
    await this.notifyStatusChange(id, {} as PresenceStatus);

    this.logger.debug(`Updated presence for user ${id}: ${dto.status}`);

    return this.toResponse(presence);
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  /**
   * Subscribe to presence updates of other users
   */
  async subscribeToPresence(
    subscriberId: string,
    targetIds: string[],
  ): Promise<void> {
    for (const targetId of targetIds) {
      if (subscriberId === targetId) continue;

      if (subscriberId && targetId) {
        const subscriptionKey = this.getSubscriptionKey(subscriberId);
        await this.redis.sadd(subscriptionKey, targetId);

        const subscriberKey = this.getSubscriberKey(targetId);
        await this.redis.sadd(subscriberKey, subscriberId);
      } else {
        this.logger.error(
          'Presence error: subscriberId or targetId is undefined',
        );
        return;
      }
      // Send initial presence status
      const presence = await this.getPresence({
        userId: targetId,
        status: [PRESENCE_STATUS.ONLINE],
      });
      // console.log('from sub', { presence });
      if (presence) {
        await this.appGateway.sendToUser(
          subscriberId,
          PresenceEvents.STATUS_CHANGE,
          this.toResponse(presence),
        );
      }
    }

    this.logger.debug(
      `User ${subscriberId} subscribed to ${targetIds.length} users`,
    );
  }

  /**
   * Unsubscribe from presence updates
   */
  async unsubscribeFromPresence(
    subscriberId: string,
    targetIds: string[],
  ): Promise<void> {
    for (const targetId of targetIds) {
      const subscriptionKey = this.getSubscriptionKey(subscriberId);
      await this.redis.srem(subscriptionKey, targetId);

      const subscriberKey = this.getSubscriberKey(targetId);
      await this.redis.srem(subscriberKey, subscriberId);
    }

    this.logger.debug(
      `User ${subscriberId} unsubscribed from ${targetIds.length} users`,
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
    if (sessions.length > 0) {
      const data = sessions[0];
      return {
        userId: userId,
        status: data.status,
        lastSeen: new Date(data.lastSeen),
        deviceId: data.deviceId,
        sessionId: data.sessionId,
        customStatus: data.customStatus,
        connectedAt: data.connectedAt,
        metadata: data.metadata,
      };
    }

    // Fallback to MongoDB
    const presence = await this.presenceModel.findOne({ userId });
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

    // Check for inactivity
    for (const session of allSessions) {
      const lastSeen = new Date(session.lastSeen);
      const timeDiff = now.getTime() - lastSeen.getTime();

      if (timeDiff > inactiveThreshold) {
        // Mark the user as away
        await this.updatePresence({
          dto: { status: PRESENCE_STATUS.AWAY },
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

  // ==================== PRIVATE HELPERS ====================

  private async updateRedisPresence(userId: string, data: any): Promise<void> {
    const key = this.getRedisKey(userId, data.deviceId);
    await this.redis.setex(
      key,
      PRESENCE_CONFIG.PRESENCE_TTL,
      JSON.stringify(data),
    );
  }

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
    userId: string,
    status: PresenceStatus,
  ): Promise<void> {
    const subscribers = await this.getSubscribers(userId);
    const presence = await this.getPresence({ userId });

    for (const subscriberId of subscribers) {
      if (presence) {
        await this.appGateway.sendToUser(
          subscriberId,
          this.getStatusEvent(status),
          this.toResponse(presence),
        );
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

  private toResponse(presence: Presence): Presence {
    return {
      userId: presence.userId,
      status: presence.status as PresenceStatus,
      lastSeen: presence.lastSeen,
      deviceId: presence.deviceId,
      sessionId: presence.sessionId,
      customStatus: presence.customStatus,
      expiresAt: presence.expiresAt,
      metadata: presence.metadata,
    };
  }
}
