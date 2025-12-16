import { PRESENCE_STATUS } from '@presence/interfaces/presence.interface';
import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { UserSession, SocketRegistry } from '../interfaces/websocket.interface';
import { Server } from 'socket.io';
import { ResEventEnvelope } from '../interfaces/websocket.interface';

/**
 * Service for managing socket connections and user sessions
 * Supports multi-device per user and provides efficient lookup methods
 */
@Injectable()
export class SocketManagerService {
  server: Server;
  private readonly logger = new Logger(SocketManagerService.name);
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  private isServerInitialized = false;

  // Queue for messages before server is ready
  private pendingMessages: Array<{
    userId: string;
    event: string;
    data: any;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(@InjectRedis() private readonly redis: Redis) {}

  setServer(server: Server): void {
    if (this.server) {
      this.logger.warn('Server instance is being overwritten');
    }

    this.server = server;
    this.isServerInitialized = true;

    // Process any pending messages
    this.processPendingMessages();
  }

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
      status: 'online',
    };

    // Store in Redis with expiration
    await this.redis.hset(sessionKey, deviceId, JSON.stringify(sessionData));
    await this.redis.expire(sessionKey, this.SESSION_TTL);

    // Add to socket→user mapping
    await this.redis.set(
      this.getSocketUserKey(socketId),
      JSON.stringify({ userId, deviceId }),
      'EX',
      this.SESSION_TTL,
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
   * Update session info for a user/device
   * Can update lastSeen, status, and customStatus
   */
  async updateSession({
    userId,
    deviceId,
    updates,
  }: {
    userId: string;
    deviceId: string;
    updates?: Partial<
      Pick<UserSession, 'lastSeen' | 'status' | 'customStatus' | 'metadata'>
    >;
  }): Promise<void> {
    const sessionKey = this.getUserSessionKey(userId);
    const sessionData = await this.redis.hget(sessionKey, deviceId);
    // console.log('line 85 socket manager', { updates });

    if (sessionData) {
      const session: UserSession = JSON.parse(sessionData);
      if (updates.lastSeen) session.lastSeen = updates.lastSeen;
      if (updates.status) session.status = updates.status;
      if (updates.customStatus !== undefined)
        session.customStatus = updates.customStatus;
      session.metadata = updates.metadata || {};

      await this.redis.hset(sessionKey, deviceId, JSON.stringify(session));
    }
  }

  /**
   * Update user's last seen timestamp
   */
  // async updateLastSeen(userId: string, deviceId: string): Promise<void> {
  //   const sessionKey = this.getUserSessionKey(userId);
  //   const sessionData = await this.redis.hget(sessionKey, deviceId);

  //   if (sessionData) {
  //     const session: UserSession = JSON.parse(sessionData);
  //     session.lastSeen = new Date();

  //     await this.redis.hset(sessionKey, deviceId, JSON.stringify(session));
  //   }
  // }

  /**
   * Get all sessions for a user, or all users if userId is undefined (efficient for large Redis)
   */
  async getUserSessions({
    userId,
    status,
  }: {
    userId?: string;
    status?: PRESENCE_STATUS[];
  }): Promise<UserSession[]> {
    const sessions: UserSession[] = [];

    // --- A) Fetch sessions for a specific user ---
    if (userId) {
      const sessionKey = this.getUserSessionKey(userId);
      const userSessions = await this.redis.hgetall(sessionKey);

      for (const raw of Object.values(userSessions)) {
        try {
          sessions.push(JSON.parse(raw) as UserSession);
        } catch (_) {
          // ignore corrupted entries
        }
      }

      return status
        ? sessions.filter((s: any) => status.includes(s.status))
        : sessions;
    }

    // --- B) Fetch ALL sessions for all users ---
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'user:session:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const userSessions = await this.redis.hgetall(key);

        for (const raw of Object.values(userSessions)) {
          try {
            sessions.push(JSON.parse(raw) as UserSession);
          } catch (_) {
            // ignore corrupted entries
          }
        }
      }
    } while (cursor !== '0');

    return status
      ? sessions.filter((s: any) => status.includes(s.status))
      : sessions;
  }

  /**
   * Get all sockets for a user
   */
  async getUserSockets({
    userId,
    status,
  }: {
    userId: string;
    status?: PRESENCE_STATUS[];
  }): Promise<string[]> {
    const sessionKey = this.getUserSessionKey(userId);
    const sessions = await this.redis.hgetall(sessionKey);

    const parsedSessions = Object.values(sessions).map((session) =>
      JSON.parse(session as string),
    );

    if (!status || status.length === 0) {
      return parsedSessions.map((s) => s.socketId);
    }

    return parsedSessions
      .filter((session) => status.includes(session.status))
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
    const sockets = await this.getUserSockets({ userId });
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

  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    // If server not ready, queue the message
    if (!this.isServerInitialized) {
      return new Promise((resolve, reject) => {
        this.pendingMessages.push({
          userId,
          event,
          data,
          resolve,
          reject,
        });
      });
    }

    const sockets = await this.getUserSockets({ userId });

    if (sockets.length === 0) {
      this.logger.debug(`User ${userId} has no active sockets`);
      return;
    }

    const envelope: ResEventEnvelope = {
      version: '1.0.0',
      timestamp: new Date(),
      targetId: data.targetId,
      payload: data,
    };

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit(event, { ...envelope });
    });

    this.logger.debug(
      `Sent event "${event}" to user ${userId} on ${sockets.length} socket(s)`,
    );
  }

  private processPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.sendToUser(message.userId, message.event, message.data)
          .then(message.resolve)
          .catch(message.reject);
      }
    }
  }
}
