import { Module, forwardRef } from '@nestjs/common';
import { Cacheable } from 'cacheable';
import { createKeyv } from '@keyv/redis';
import { CacheService } from './cache.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchModule } from '@modules/search.module';

@Module({
  imports: [ConfigModule, forwardRef(() => SearchModule)],
  providers: [
    {
      provide: 'CACHE_INSTANCE',
      useFactory: () => {
        const secondary = createKeyv('redis://localhost:6379');
        return new Cacheable({
          secondary,
          ttl: '4h',
        });
      },
    },
    CacheService,
  ],

  exports: ['CACHE_INSTANCE', CacheService],
})
export class CacheModule {}
