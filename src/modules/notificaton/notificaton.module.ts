import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { Presence, PresenceSchema } from '@schemas/presence.schema';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notificationQueue',
    }),
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Presence.name, schema: PresenceSchema },
    ]),
  ],

  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificatonModule {}
