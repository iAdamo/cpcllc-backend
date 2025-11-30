import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { PreferencesService } from './preferences.service';
import { NotificationController } from './notification.controller';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { Presence, PresenceSchema } from '@schemas/presence.schema';
import {
  UserPreference,
  UserPreferenceSchema,
} from './schemas/user-preference.schema';
import { NotificationProcessor } from './processors/notification.processor';
import { InAppAdapter, PushAdapter, EmailAdapter } from './adapters';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-delivery',
    }),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Presence.name, schema: PresenceSchema },
      { name: UserPreference.name, schema: UserPreferenceSchema },
    ]),
  ],

  providers: [
    NotificationService,
    BullModule,
    PreferencesService,
    InAppAdapter,
    PushAdapter,
    EmailAdapter,
  ],
  controllers: [NotificationController],
  exports: [NotificationService, BullModule],
})
export class NotificatonModule {}
