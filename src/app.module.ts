import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import databaseConfig from '@config/app.config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UsersModule } from './modules/users/users.module';
import { AppConfig } from '@types';
import { AuthModule } from './modules/auth/auth.module';
import { ServicesModule } from './modules/services/services.module';
import { ReviewsModule } from './modules/review/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { ProviderModule } from './modules/provider/provider.module';
import { AdminModule } from './modules/admin/admin.module';
import { CacheModule } from './modules/cache/cache.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificatonModule } from './modules/notification/notification.module';
import { WebSocketModule } from '@modules/websocket.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      cache: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => {
        const databaseConfig =
          configService.get<AppConfig['database']>('database');
        if (!databaseConfig) {
          throw new Error('Database configuration not found');
        }
        return databaseConfig;
      },
      inject: [ConfigService],
    }),

    UsersModule,
    AuthModule,
    AdminModule,
    ServicesModule,
    ReviewsModule,
    SearchModule,
    ProviderModule,
    CacheModule,
    ChatModule,
    NotificatonModule,
    WebSocketModule,
  ],
  controllers: [],
  providers: [],
  exports: [CacheModule],
})
export class AppModule {}
