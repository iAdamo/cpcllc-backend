import { Module, forwardRef, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceGateway } from '@websocket/gateways/presence.gateway';
import { PresenceService } from '@presence/presence.service';
import { Presence, PresenceSchema } from '@presence/schemas/presence.schema';
import { WebSocketModule } from '@websocket/websocket.module';
import { AppGateway } from '@websocket/gateways/app.gateway';

@Module({
  imports: [
    forwardRef(() => WebSocketModule),

    MongooseModule.forFeature([
      { name: Presence.name, schema: PresenceSchema },
    ]),
    ScheduleModule.forRoot(),
  ],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
