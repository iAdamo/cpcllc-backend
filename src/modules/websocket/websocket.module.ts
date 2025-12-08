import { Module, Global, DynamicModule, forwardRef } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AppGateway } from './gateways/app.gateway';
import { EventRouterService } from './services/event-router.service';
import { SocketManagerService } from './services/socket-manager.service';
import { SocketValidationPipe } from './socket-validation.pipe';
import { RateLimiterService } from './services/rate-limiter.service';

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
        EventRouterService,
        SocketManagerService,
        SocketValidationPipe,
        RateLimiterService,
      ],
      exports: [
        AppGateway,
        EventRouterService,
        SocketManagerService,
        SocketValidationPipe,
        RateLimiterService,
      ],
    };
  }
}
