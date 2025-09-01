import { Module } from '@nestjs/common';
import { SearchController } from '@services/search.controller';
import { SearchService } from '@services/search.service';
import { UsersModule } from '@modules/users.module';
import { ServicesModule } from '@modules/services.module';
import { CacheModule } from 'src/cache/cache.module';

@Module({
  imports: [UsersModule, ServicesModule, CacheModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
