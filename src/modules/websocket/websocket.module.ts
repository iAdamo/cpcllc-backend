import { Module, Global, DynamicModule, forwardRef } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { MongooseModule } from '@nestjs/mongoose';
import { AppGateway } from './gateways/app.gateway';
import { EventRouterService } from './services/event-router.service';
import { SocketManagerService } from './services/socket-manager.service';
import { SocketValidationPipe } from './socket-validation.pipe';
import { RateLimiterService } from './services/rate-limiter.service';
import { PresenceModule } from '@presence/presence.module';
import { ChatGateway } from './gateways/chat.gateway';
import { NotificationGateway } from './gateways/notification.gateway';
import { PresenceGateway } from './gateways/presence.gateway';
import { ChatService } from '@chat/chat.service';
import { NotificationService } from '@notification/services/notification.service';
import { PreferenceService } from '@notification/services/preference.service';
import { PresenceService } from '@presence/presence.service';
import { ChatModule } from '@chat/chat.module';
import { NotificationModule } from '@notification/notification.module';
import { Presence, PresenceSchema } from '@presence/schemas/presence.schema';
/**
 * Core WebSocket Module - Provides foundational WebSocket services
 * This module should be imported once in the root application module
 */
@Global()
@Module({})
export class WebSocketModule {
  static forRoot(): DynamicModule {
    return {
      module: WebSocketModule,

      imports: [
        forwardRef(() => ChatModule),
        // forwardRef(() => NotificationModule),
        forwardRef(() => PresenceModule),
        NotificationModule,
        MongooseModule.forFeature([
          { name: Presence.name, schema: PresenceSchema },
        ]),
        RedisModule.forRoot({
          type: 'single',
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          options: {
            retryStrategy: (_attempts: number) => 100,
            maxRetriesPerRequest: 3,
          },
        }),
      ],
      providers: [
        AppGateway,
        ChatGateway,
        NotificationGateway,
        PresenceGateway,
        EventRouterService,
        SocketManagerService,
        SocketValidationPipe,
        RateLimiterService,
      ],
      exports: [
        AppGateway,
        PresenceGateway,
        EventRouterService,
        SocketManagerService,
        SocketValidationPipe,
        RateLimiterService,
      ],
    };
  }
}
