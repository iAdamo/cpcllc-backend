import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

/**
 * Rate limiting service for WebSocket events
 * Prevents spam and abuse with configurable limits per event type
 */
export interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in seconds
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly defaultConfig: RateLimitConfig = {
    maxRequests: 100, // 100 requests
    timeWindow: 60, // per minute
  };

  // Different limits for different event types
  private readonly eventLimits: Map<string, RateLimitConfig> = new Map([
    ['chat:send_message', { maxRequests: 30, timeWindow: 60 }],
    ['chat:typing_start', { maxRequests: 60, timeWindow: 60 }],
    ['notification:send', { maxRequests: 10, timeWindow: 60 }],
  ]);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Check if request is allowed based on rate limits
   */
  async isAllowed(
    userId: string,
    event: string,
    socketId: string,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const config = this.eventLimits.get(event) || this.defaultConfig;
    const key = this.getRateLimitKey(userId, event, socketId);

    try {
      const current = await this.redis.get(key);
      const currentCount = current ? parseInt(current, 10) : 0;

      if (currentCount >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: await this.getKeyExpiry(key),
        };
      }

      // Increment counter
      if (!current) {
        await this.redis.setex(key, config.timeWindow, '1');
      } else {
        await this.redis.incr(key);
      }

      return {
        allowed: true,
        remaining: Math.max(0, config.maxRequests - (currentCount + 1)),
        resetTime: await this.getKeyExpiry(key),
      };
    } catch (error) {
      this.logger.error('Rate limit check failed:', error);
      // Allow on error to avoid blocking users
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.timeWindow * 1000,
      };
    }
  }

  /**
   * Get remaining requests for a user/event
   */
  async getRemainingRequests(
    userId: string,
    event: string,
    socketId: string,
  ): Promise<number> {
    const config = this.eventLimits.get(event) || this.defaultConfig;
    const key = this.getRateLimitKey(userId, event, socketId);

    const current = await this.redis.get(key);
    const currentCount = current ? parseInt(current, 10) : 0;

    return Math.max(0, config.maxRequests - currentCount);
  }

  /**
   * Reset rate limit for a user/event
   */
  async resetLimit(
    userId: string,
    event: string,
    socketId: string,
  ): Promise<void> {
    const key = this.getRateLimitKey(userId, event, socketId);
    await this.redis.del(key);
  }

  private getRateLimitKey(
    userId: string,
    event: string,
    socketId: string,
  ): string {
    return `rate_limit:${userId}:${event}:${socketId}`;
  }

  private async getKeyExpiry(key: string): Promise<number> {
    const ttl = await this.redis.ttl(key);
    return Date.now() + (ttl > 0 ? ttl * 1000 : 0);
  }
}
