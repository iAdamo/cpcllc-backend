import { Module, forwardRef } from '@nestjs/common';
import { SearchController } from '@services/search.controller';
import { SearchService } from '@services/search.service';
import { UsersModule } from '@modules/users.module';
import { ServicesModule } from '@modules/services.module';
import { CacheModule } from '@modules/cache.module';

@Module({
  imports: [UsersModule, ServicesModule, forwardRef(() => CacheModule)],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
