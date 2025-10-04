import { Injectable, Inject } from '@nestjs/common';
import { Cacheable } from 'cacheable';

@Injectable()
export class CacheService {
  constructor(@Inject('CACHE_INSTANCE') private readonly cache: Cacheable) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number | string): Promise<void> {
    await this.cache.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    if (typeof (this.cache as any).publish === 'function') {
      
      await (this.cache as any).publish(channel, message);
    } else {
      throw new Error('Cache instance does not support publish');
    }
  }
}
