import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

/**
 * Custom Socket.IO adapter with Redis for horizontal scaling
 * Enables multiple server instances to communicate via Redis Pub/Sub
 */
export class RedisSocketAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisSocketAdapter.name);
  private readonly redisPub: Redis;
  private readonly redisSub: Redis;
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app: any, redisPub: Redis, redisSub: Redis) {
    super(app);
    this.redisPub = redisPub;
    this.redisSub = redisSub;
  }

  async connectToRedis(): Promise<void> {
    try {
      this.adapterConstructor = createAdapter(this.redisPub, this.redisSub);
      this.logger.log('Redis adapter connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Redis adapter attached to Socket.IO server');
    } else {
      this.logger.warn('Redis adapter not available, using in-memory adapter');
    }

    return server;
  }
}
