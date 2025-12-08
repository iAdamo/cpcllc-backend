import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceGateway } from '@websocket/gateways/presence.gateway';
import { PresenceService } from '@presence/presence.service';
import { Presence, PresenceSchema } from '@presence/schemas/presence.schema';
import { SocketManagerService } from '@websocket/services/socket-manager.service';
import { AppGateway } from '@websocket/gateways/app.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Presence.name, schema: PresenceSchema },
    ]),
    ScheduleModule.forRoot(),
  ],
  providers: [
    PresenceGateway,
    PresenceService,
    SocketManagerService,
    AppGateway,
  ],
  exports: [PresenceService],
})
export class PresenceModule {}
