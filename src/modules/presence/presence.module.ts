import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PresenceService } from '@presence/presence.service';
import { PresenceController } from './presence.controller';
import { Presence, PresenceSchema } from '@presence/schemas/presence.schema';
import { WebSocketModule } from '@websocket/websocket.module';
import { CacheModule } from '@cache/cache.module';
import { NotificationModule } from '@notification/notification.module';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([
      { name: Presence.name, schema: PresenceSchema },
    ]),
    forwardRef(() => WebSocketModule),
    CacheModule,
  ],
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
