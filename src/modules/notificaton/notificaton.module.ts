import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notificationQueue',
    }),
  ],

  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificatonModule {}
