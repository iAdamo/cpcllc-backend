import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import databaseConfig from '@config/database.config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UsersModule } from './modules/users/users.module';
import { DatabaseConfig } from '@types';
import { AuthModule } from './modules/auth/auth.module';
import { ServicesModule } from './modules/services/services.module';
import { ReviewsModule } from './modules/review/reviews.module';
import { SearchModule } from './modules/search/search.module';
import { ProviderModule } from './modules/provider/provider.module';
import { AdminModule } from './modules/admin/admin.module';
import { MediaModule } from './modules/media/media.module';
import { CacheModule } from './cache/cache.module';

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
          configService.get<DatabaseConfig['database']>('database');
        if (!databaseConfig) {
          throw new Error('Database configuration not found');
        }
        return databaseConfig;
      },
      inject: [ConfigService],
    }),
    // CacheModule.registerAsync({
    //  useFactory: async () => {
    //    return {
    //      stores: [
    //        new Keyv({
    //          store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
    //        }),
    //        createKeyv('redis://127.0.0.1:6379'),
    //      ],
    //    };
    //  },
    //  inject: [ConfigService],
    //  isGlobal: true,
    //}),

    UsersModule,
    AuthModule,
    AdminModule,
    ServicesModule,
    ReviewsModule,
    SearchModule,
    ProviderModule,
    MediaModule,
    CacheModule,
  ],
  controllers: [],
  providers: [],
  exports: [CacheModule],
})
export class AppModule {}
