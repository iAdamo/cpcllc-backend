import { WsJwtGuard } from '@modules/jwt/jwt.guard';
import { Module, Global, DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AppGateway } from './app.gateway';
import { EventRouterService } from './event-router.service';
import { SocketManagerService } from './socket-manager.service';
import { SocketValidationPipe } from './socket-validation.pipe';
import { RateLimiterService } from './rate-limiter.service';

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
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '24h' },
        }),
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
        WsJwtGuard,
        SocketValidationPipe,
        RateLimiterService,
      ],
      exports: [
        AppGateway,
        EventRouterService,
        SocketManagerService,
        WsJwtGuard,
        SocketValidationPipe,
        RateLimiterService,
      ],
    };
  }
}
