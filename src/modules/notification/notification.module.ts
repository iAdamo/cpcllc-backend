import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

// Services
import { NotificationService } from './services/notification.service';
import { PreferenceService } from './services/preference.service';
import { DeliveryService } from './services/delivery.service';
import { TemplateService } from './services/template.service';
import { QueueService } from './queues/queue.service';

// Processors
import { NotificationProcessor } from './processors/notification.processor';
import { ScheduledNotificationProcessor } from './processors/scheduled.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

// Gateway
import { NotificationGateway } from './gateways/notification.gateway';

// Controller
import { NotificationController } from '@notification/controllers/notification.controller';

// Jobs
import { CronJob } from './jobs/cron.job';

// Schemas
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import {
  UserPreference,
  UserPreferenceSchema,
} from './schemas/user-preference.schema';
import {
  NotificationLog,
  NotificationLogSchema,
} from './schemas/notification-log.schema';

// Shared Services
import { EmailService } from '@notification/services/email.service';
import { PushService } from '@notification/services/push.service';
import { SmsService } from '@notification/services/sms.service';

// Core Dependencies
import { EventRouterService } from '@websocket/services/event-router.service';

// Queue Configs
import {
  NOTIFICATION_DELIVERY_QUEUE_CONFIG,
  NOTIFICATION_SCHEDULED_QUEUE_CONFIG,
  NOTIFICATION_CLEANUP_QUEUE_CONFIG,
} from './queues/notification.queue';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: UserPreference.name, schema: UserPreferenceSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      },
    }),

    BullModule.registerQueue(
      NOTIFICATION_DELIVERY_QUEUE_CONFIG,
      NOTIFICATION_SCHEDULED_QUEUE_CONFIG,
      NOTIFICATION_CLEANUP_QUEUE_CONFIG,
    ),

    ScheduleModule.forRoot(),
  ],

  providers: [
    // Core Services
    NotificationService,
    PreferenceService,
    DeliveryService,
    TemplateService,
    QueueService,

    // Shared Services
    EmailService,
    PushService,
    SmsService,

    // BullMQ Processors
    NotificationProcessor,
    ScheduledNotificationProcessor,
    CleanupProcessor,

    // Gateway
    NotificationGateway,

    // Jobs
    CronJob,

    // Core Dependencies
    // EventRouterService,
  ],

  controllers: [NotificationController],

  exports: [
    NotificationService,
    PreferenceService,
    DeliveryService,
    TemplateService,
    QueueService,
    EmailService,
    PushService,
    SmsService,
  ],
})
export class NotificationModule {}
