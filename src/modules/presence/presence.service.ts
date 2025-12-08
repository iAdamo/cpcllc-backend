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
// import {
//   PresenceEvents,
//   PRESENCE_STATUS,
//   PRESENCE_CONFIG,
//   PresenceStatus,
// } from '../constants/presence.constants';
import { SocketManagerService } from '@websocket/services/socket-manager.service';
import { AppGateway } from '@websocket/gateways/app.gateway';

@Injectable()
export class PresenceService implements OnModuleInit {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    @InjectModel(Presence.name)
    private readonly presenceModel: Model<Presence>,

    @InjectRedis()
    private readonly redis: Redis,

    private readonly socketManager: SocketManagerService,
    private readonly appGateway: AppGateway,
  ) {}

  async onModuleInit() {
    await this.initializePresenceSystem();
  }

  private async initializePresenceSystem(): Promise<void> {
    // Clean up any stale presence data on startup
    await this.cleanupStalePresence();
    this.logger.log('Presence system initialized');
  }

  // ==================== CORE PRESENCE METHODS ====================

  /**
   * Set user as online (called on WebSocket connection)
   */
  async setOnline(
    userId: string,
    deviceId: string,
    sessionId: string,
    deviceInfo?: DeviceInfo,
  ): Promise<Presence> {
    const now = new Date();

    // Update Redis (fast cache)
    await this.updateRedisPresence(userId, {
      status: PRESENCE_STATUS.ONLINE,
      lastSeen: now,
      deviceId,
      sessionId,
      deviceInfo,
    });

    // Update MongoDB (persistent storage)
    let presence = await this.presenceModel.findOne({ userId });

    if (!presence) {
      presence = new this.presenceModel({
        userId,
        status: PRESENCE_STATUS.ONLINE,
        lastSeen: now,
        deviceId,
        sessionId,
        metadata: { deviceInfo },
        createdAt: now,
        updatedAt: now,
      });
    } else {
      presence.status = PRESENCE_STATUS.ONLINE;
      presence.lastSeen = now;
      presence.deviceId = deviceId;
      presence.sessionId = sessionId;
      presence['updatedAt'] = now;

      if (deviceInfo) {
        presence.metadata = {
          ...presence.metadata,
          deviceInfo,
        };
      }
    }

    await presence.save();

    // Notify subscribers
    await this.notifyStatusChange(userId, PRESENCE_STATUS.ONLINE);

    this.logger.log(`User ${userId} is now online (device: ${deviceId})`);

    return this.toResponse(presence);
  }

  /**
   * Set user as offline (called on WebSocket disconnection)
   */
  async setOffline(userId: string, deviceId?: string): Promise<Presence> {
    const now = new Date();

    // Check if user has other active devices
    const hasOtherDevices = await this.hasActiveDevices(userId, deviceId);

    let newStatus = PRESENCE_STATUS.OFFLINE;

    if (hasOtherDevices) {
      // User still online from other devices
      newStatus = PRESENCE_STATUS.ONLINE;

      // Just remove this device from Redis
      if (deviceId) {
        await this.redis.del(this.getRedisKey(userId, deviceId));
      }
    } else {
      // User completely offline
      newStatus = PRESENCE_STATUS.OFFLINE;

      // Update Redis for all devices
      const deviceKeys = await this.redis.keys(this.getRedisKey(userId, '*'));
      for (const key of deviceKeys) {
        await this.redis.del(key);
      }
    }

    // Update MongoDB
    const presence = await this.presenceModel.findOneAndUpdate(
      { userId },
      {
        status: newStatus,
        lastSeen: now,
        updatedAt: now,
        ...(deviceId && { deviceId: null }),
      },
      { new: true, upsert: true },
    );

    // Notify subscribers if status changed to offline
    if (newStatus === PRESENCE_STATUS.OFFLINE) {
      await this.notifyStatusChange(userId, PRESENCE_STATUS.OFFLINE);
    }

    this.logger.log(
      `User ${userId} is now ${newStatus} ${deviceId ? `(device: ${deviceId})` : ''}`,
    );

    return this.toResponse(presence);
  }

  /**
   * Update user presence status
   */
  async updatePresence(
    userId: string,
    dto: UpdatePresenceDto,
  ): Promise<Presence> {
    const now = new Date();

    // Update MongoDB
    const presence = await this.presenceModel.findOneAndUpdate(
      { userId },
      {
        status: dto.status,
        customStatus: dto.customStatus,
        lastSeen: now,
        updatedAt: now,
        metadata: dto.metadata,
      },
      { new: true, upsert: true },
    );

    // Update Redis for all active devices
    const deviceKeys = await this.redis.keys(this.getRedisKey(userId, '*'));
    for (const key of deviceKeys) {
      const presenceData = await this.redis.get(key);
      if (presenceData) {
        const data = JSON.parse(presenceData);
        await this.redis.setex(
          key,
          PRESENCE_CONFIG.PRESENCE_TTL,
          JSON.stringify({
            ...data,
            status: dto.status || data.status,
            customStatus: dto.customStatus,
            lastSeen: now,
          }),
        );
      }
    }

    // Notify subscribers
    if (dto.status) {
      await this.notifyStatusChange(userId, dto.status);
    }

    this.logger.debug(`Updated presence for user ${userId}: ${dto.status}`);

    return this.toResponse(presence);
  }

  /**
   * Update last seen timestamp (heartbeat)
   */
  async updateLastSeen(userId: string, deviceId: string): Promise<void> {
    const now = new Date();
    const redisKey = this.getRedisKey(userId, deviceId);

    // Update Redis
    const presenceData = await this.redis.get(redisKey);
    if (presenceData) {
      const data = JSON.parse(presenceData);
      await this.redis.setex(
        redisKey,
        PRESENCE_CONFIG.PRESENCE_TTL,
        JSON.stringify({
          ...data,
          lastSeen: now,
        }),
      );
    }

    // Update MongoDB if user is online
    await this.presenceModel.findOneAndUpdate(
      { userId, status: PRESENCE_STATUS.ONLINE },
      { lastSeen: now },
      { new: true },
    );

    // If user was away, mark as online
    const currentStatus = await this.getUserStatus(userId);
    if (currentStatus === PRESENCE_STATUS.AWAY) {
      await this.updatePresence(userId, { status: PRESENCE_STATUS.ONLINE });
    }
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

      const subscriptionKey = this.getSubscriptionKey(subscriberId);
      await this.redis.sadd(subscriptionKey, targetId);

      const subscriberKey = this.getSubscriberKey(targetId);
      await this.redis.sadd(subscriberKey, subscriberId);

      // Send initial presence status
      const presence = await this.getPresence(targetId);
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
  async getPresence(userId: string): Promise<Presence | null> {
    // Try Redis first (fast)
    const deviceKeys = await this.redis.keys(this.getRedisKey(userId, '*'));

    if (deviceKeys.length > 0) {
      // User has active devices in Redis
      const latestKey = deviceKeys[0];
      const presenceData = await this.redis.get(latestKey);

      if (presenceData) {
        const data = JSON.parse(presenceData);
        return {
          userId: new Types.ObjectId(userId),
          status: data.status,
          lastSeen: new Date(data.lastSeen),
          deviceId: data.deviceId,
          sessionId: data.sessionId,
          customStatus: data.customStatus,
          metadata: data.metadata,
        };
      }
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
      const presence = await this.getPresence(userId);

      if (presence) {
        presences.push({
          userId: presence.userId.toString(),
          status: presence.status,
          lastSeen: presence.lastSeen,
          customStatus: presence.customStatus,
          isOnline: presence.status === PRESENCE_STATUS.ONLINE,
          deviceId: presence.deviceId,
        });
      } else {
        // Default offline presence
        presences.push({
          userId,
          status: PRESENCE_STATUS.OFFLINE,
          lastSeen: new Date(0),
          isOnline: false,
        });
      }
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
    const presence = await this.getPresence(userId);
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

    // Get all online users from Redis
    const onlineKeys = await this.redis.keys('presence:*:*');

    for (const key of onlineKeys) {
      const presenceData = await this.redis.get(key);
      if (!presenceData) continue;

      const data = JSON.parse(presenceData);
      const lastSeen = new Date(data.lastSeen);
      const timeDiff = now.getTime() - lastSeen.getTime();

      if (
        timeDiff > inactiveThreshold &&
        data.status === PRESENCE_STATUS.ONLINE
      ) {
        // Mark as away
        const userId = key.split(':')[1];
        await this.updatePresence(userId, { status: PRESENCE_STATUS.AWAY });
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

    for (const subscriberId of subscribers) {
      const presence = await this.getPresence(userId);
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
