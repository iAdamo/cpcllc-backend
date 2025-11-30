import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { UserSession, SocketRegistry } from './interfaces/websocket.interface';

/**
 * Service for managing socket connections and user sessions
 * Supports multi-device per user and provides efficient lookup methods
 */
@Injectable()
export class SocketManagerService {
  private readonly logger = new Logger(SocketManagerService.name);
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Add user session to registry
   */
  async addUserSession(
    userId: string,
    socketId: string,
    deviceId: string,
    sessionId: string,
  ): Promise<void> {
    const sessionKey = this.getUserSessionKey(userId);
    const sessionData: UserSession = {
      userId,
      socketId,
      deviceId,
      sessionId,
      connectedAt: new Date(),
      lastSeen: new Date(),
      isOnline: true,
    };

    // Store in Redis with expiration
    await this.redis.hset(sessionKey, deviceId, JSON.stringify(sessionData));
    await this.redis.expire(sessionKey, this.SESSION_TTL);

    // Add to socket→user mapping
    await this.redis.set(
      this.getSocketUserKey(socketId),
      JSON.stringify({ userId, deviceId }),
    );

    this.logger.log(`User ${userId} connected from device ${deviceId}`);
  }

  /**
   * Remove user session
   */
  async removeUserSession(socketId: string): Promise<void> {
    const socketUser = await this.redis.get(this.getSocketUserKey(socketId));

    if (socketUser) {
      const { userId, deviceId } = JSON.parse(socketUser);
      const sessionKey = this.getUserSessionKey(userId);

      await this.redis.hdel(sessionKey, deviceId);
      await this.redis.del(this.getSocketUserKey(socketId));

      this.logger.log(`User ${userId} disconnected from device ${deviceId}`);
    }
  }

  /**
   * Update user's last seen timestamp
   */
  async updateLastSeen(userId: string, deviceId: string): Promise<void> {
    const sessionKey = this.getUserSessionKey(userId);
    const sessionData = await this.redis.hget(sessionKey, deviceId);

    if (sessionData) {
      const session: UserSession = JSON.parse(sessionData);
      session.lastSeen = new Date();

      await this.redis.hset(sessionKey, deviceId, JSON.stringify(session));
    }
  }

  /**
   * Get all sockets for a user
   */
  async getUserSockets(userId: string): Promise<string[]> {
    const sessionKey = this.getUserSessionKey(userId);
    const sessions = await this.redis.hgetall(sessionKey);

    return Object.values(sessions)
      .map((session) => JSON.parse(session as string))
      .filter((session) => session.isOnline)
      .map((session) => session.socketId);
  }

  /**
   * Get user ID from socket ID
   */
  async getUserIdFromSocket(socketId: string): Promise<string | null> {
    const socketUser = await this.redis.get(this.getSocketUserKey(socketId));
    return socketUser ? JSON.parse(socketUser).userId : null;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = await this.getUserSockets(userId);
    return sockets.length > 0;
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(userIds: string[]): Promise<Set<string>> {
    const onlineUsers = new Set<string>();

    for (const userId of userIds) {
      if (await this.isUserOnline(userId)) {
        onlineUsers.add(userId);
      }
    }

    return onlineUsers;
  }

  private getUserSessionKey(userId: string): string {
    return `user:session:${userId}`;
  }

  private getSocketUserKey(socketId: string): string {
    return `socket:user:${socketId}`;
  }
}
