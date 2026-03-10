import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigSchema, AppConfig } from './app-config.schema';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { CacheModule } from '@cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppConfig.name, schema: AppConfigSchema },
    ]),
    CacheModule,
  ],
  controllers: [AppConfigController],
  providers: [AppConfigService],
})
export class AppConfigModule {}
