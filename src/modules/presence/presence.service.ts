import { Injectable, Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { AppGateway } from '@websocket/gateways/app.gateway';
import { SocketManagerService } from '@websocket/services/socket-manager.service';
import {
  IPresence,
  UpdatePresenceDto,
  SubscribePresenceDto,
  PresenceStatus,
} from './interfaces/presence.interface';
import { Presence as PresenceDocument } from './schemas/presence.schema';
import { PresenceEvents } from '@websocket/events/presence.events';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly PRESENCE_TTL = 5 * 60; // 5 minutes in seconds

  constructor(
    @InjectModel(PresenceDocument.name)
    private presenceModel: Model<PresenceDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly appGateway: AppGateway,
    private readonly socketManager: SocketManagerService,
  ) {}

  /**
   * Update user presence status
   */
  async updatePresence(
    userId: string,
    dto: UpdatePresenceDto,
  ): Promise<IPresence> {
    const now = new Date();

    let presence = await this.presenceModel.findOne({ userId });

    if (!presence) {
      presence = new this.presenceModel({
        userId,
        status: dto.status,
        lastSeen: now,
        updatedAt: now,
        customStatus: dto.customStatus,
      });
    } else {
      presence.status = dto.status;
      presence.lastSeen = now;
      presence['updatedAt'] = now;
      presence.customStatus = dto.customStatus;
    }

    await presence.save();

    // Cache presence in Redis for fast access
    await this.cachePresence(userId, presence);

    // Broadcast presence update to subscribers
    await this.broadcastToSubscribers(userId, {
      userId,
      status: presence.status,
      lastSeen: presence.lastSeen,
      customStatus: presence.customStatus,
    });

    this.logger.log(`Presence updated for user ${userId}: ${dto.status}`);

    return this.serializePresence(presence);
  }

  /**
   * Handle user going online
   */
  async setOnline(
    userId: string,
    deviceId: string,
    sessionId: string,
  ): Promise<void> {
    const now = new Date();

    await this.presenceModel.findOneAndUpdate(
      { userId },
      {
        status: PresenceStatus.ONLINE,
        lastSeen: now,
        deviceId,
        sessionId,
        updatedAt: now,
      },
      { upsert: true, new: true },
    );

    // Broadcast online status
    await this.broadcastToSubscribers(userId, {
      userId,
      status: PresenceStatus.ONLINE,
      lastSeen: now,
    });

    this.logger.log(`User ${userId} is now online`);
  }

  /**
   * Handle user going offline
   */
  async setOffline(userId: string): Promise<void> {
    const now = new Date();

    await this.presenceModel.findOneAndUpdate(
      { userId },
      {
        status: PresenceStatus.OFFLINE,
        lastSeen: now,
        updatedAt: now,
      },
    );

    // Broadcast offline status
    await this.broadcastToSubscribers(userId, {
      userId,
      status: PresenceStatus.OFFLINE,
      lastSeen: now,
    });

    this.logger.log(`User ${userId} is now offline`);
  }

  /**
   * Subscribe to presence updates for specific users
   */
  async subscribeToPresence(
    userId: string,
    dto: SubscribePresenceDto,
  ): Promise<void> {
    const subscriptionKey = this.getSubscriptionKey(userId);

    // Add users to subscription set
    for (const targetUserId of dto.userIds) {
      await this.redis.sadd(subscriptionKey, targetUserId);
    }

    // Send current presence for subscribed users
    const presences = await this.getBulkPresence(dto.userIds);

    this.appGateway.sendToUser(
      userId,
      PresenceEvents.PRESENCE_UPDATE,
      presences,
    );

    this.logger.log(
      `User ${userId} subscribed to presence of ${dto.userIds.length} users`,
    );
  }

  /**
   * Unsubscribe from presence updates
   */
  async unsubscribeFromPresence(
    userId: string,
    dto: SubscribePresenceDto,
  ): Promise<void> {
    const subscriptionKey = this.getSubscriptionKey(userId);

    for (const targetUserId of dto.userIds) {
      await this.redis.srem(subscriptionKey, targetUserId);
    }

    this.logger.log(
      `User ${userId} unsubscribed from presence of ${dto.userIds.length} users`,
    );
  }

  /**
   * Get presence for multiple users
   */
  async getBulkPresence(userIds: string[]): Promise<IPresence[]> {
    const presences: IPresence[] = [];

    for (const userId of userIds) {
      // Try cache first
      let presence = await this.getCachedPresence(userId);

      if (!presence) {
        // Fallback to database
        const dbPresence = await this.presenceModel.findOne({ userId });
        if (dbPresence) {
          presence = this.serializePresence(dbPresence);
          await this.cachePresence(userId, dbPresence);
        } else {
          // Default offline presence
          presence = {
            userId,
            status: PresenceStatus.OFFLINE,
            lastSeen: new Date(0), // Epoch
            deviceId: '',
            sessionId: '',
          };
        }
      }

      presences.push(presence);
    }

    return presences;
  }

  /**
   * Broadcast presence update to all subscribers
   */
  private async broadcastToSubscribers(
    userId: string,
    presence: Partial<IPresence>,
  ): Promise<void> {
    const subscriberKey = this.getSubscriberKey(userId);
    const subscribers = await this.redis.smembers(subscriberKey);

    for (const subscriberId of subscribers) {
      this.appGateway.sendToUser(subscriberId, PresenceEvents.PRESENCE_UPDATE, {
        ...presence,
        userId,
      });
    }
  }

  /**
   * Cache presence in Redis
   */
  private async cachePresence(
    userId: string,
    presence: PresenceDocument,
  ): Promise<void> {
    const key = this.getPresenceCacheKey(userId);
    await this.redis.setex(
      key,
      this.PRESENCE_TTL,
      JSON.stringify(this.serializePresence(presence)),
    );
  }

  /**
   * Get cached presence
   */
  private async getCachedPresence(userId: string): Promise<IPresence | null> {
    const key = this.getPresenceCacheKey(userId);
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  private getPresenceCacheKey(userId: string): string {
    return `presence:${userId}`;
  }

  private getSubscriptionKey(userId: string): string {
    return `presence:subscriptions:${userId}`;
  }

  private getSubscriberKey(userId: string): string {
    return `presence:subscribers:${userId}`;
  }

  private serializePresence(presence: PresenceDocument): IPresence {
    return {
      userId: presence.userId.toString(),
      status: presence.status,
      lastSeen: presence.lastSeen,
      deviceId: presence.deviceId,
      sessionId: presence.sessionId,
      customStatus: presence.customStatus,
      expiresAt: presence.expiresAt,
    };
  }
}
