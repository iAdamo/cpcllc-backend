import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceService } from '@presence/presence.service';
import { Presence, PresenceSchema } from '@presence/schemas/presence.schema';
import { WebSocketModule } from '@websocket/websocket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Presence.name, schema: PresenceSchema },
    ]),
    forwardRef(() => WebSocketModule),
    ScheduleModule.forRoot(),
  ],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
