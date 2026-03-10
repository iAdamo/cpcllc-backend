import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AppConfig, AppConfigDocument } from './app-config.schema';
// import { SocketManagerService } from '@websocket/services/socket-manager.service';
// import { NotificationService } from '@notification/services/notification.service';

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @InjectModel(AppConfig.name)
    private readonly appConfigModel: Model<AppConfigDocument>,
    @InjectRedis()
    private readonly redis: Redis,
    // private readonly socketManager: SocketManagerService,
    // private readonly notificationService: NotificationService,
  ) {}

  async getConfig() {
    const config = await this.appConfigModel.findOne();

    if (!config) {
      this.logger.warn('App config not found, returning default config');
      return {
        minVersionAndroid: '1.0.0',
        minVersionIOS: '1.0.0',
        latestVersionAndroid: '1.0.0',
        latestVersionIOS: '1.0.0',
        forceUpdate: false,
        maintenanceMode: false,
        maintenanceMessage: '',
        androidStoreUrl:
          'https://play.google.com/store/apps/details?id=com.companiescenter.app',
        iosStoreUrl: 'https://apps.apple.com/app/id1234567890',
        featureFlags: {
          reels: false,
          wallet: false,
          voiceMessages: false,
        },
      };
    }

    return config;

    // if (!config) {
    //   throw new Error('App config not found');
    // }

    // return config;
  }

  /**
   * Health check
   * @returns
   */
  async check() {
    const mongoStatus = this.mongoConnection.readyState === 1 ? 'up' : 'down';

    let redisStatus = 'down';
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') redisStatus = 'up';
    } catch (_) {}

    return {
      status: mongoStatus === 'up' && redisStatus === 'up' ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: mongoStatus,
        redis: redisStatus,
      },
    };
  }
}
