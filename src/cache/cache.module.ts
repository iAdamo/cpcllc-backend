import { Module } from '@nestjs/common';
import { Cacheable } from 'cacheable';
import { createKeyv } from '@keyv/redis';
import { CacheService } from './cache.service';

@Module({
  providers: [
    {
      provide: 'CACHE_INSTANCE',
      useFactory: () => {
        const secondary = createKeyv('redis://user:pass@localhost:6379');
        return new Cacheable({
          secondary,
          ttl: '4h',
        });
      },
    },
    CacheService,
  ],

  exports: ['CACHE_INSTANCE'],
})
export class CacheModule {}
