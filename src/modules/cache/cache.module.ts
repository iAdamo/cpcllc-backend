import { Module, forwardRef } from '@nestjs/common';
import { Cacheable } from 'cacheable';
import { createKeyv } from '@keyv/redis';
import { CacheService } from './cache.service';
import { ConfigModule } from '@nestjs/config';
import { SearchModule } from '@modules/search.module';
import { ServicesModule } from '@modules/services.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => SearchModule),
    forwardRef(() => ServicesModule),
  ],
  providers: [
    {
      provide: 'CACHE_INSTANCE',
      useFactory: () => {
        const secondary = createKeyv(
          process.env.REDIS_URL || '',
        );
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
