import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebSocketModule } from '@websocket/websocket.module';
import { PresenceGateway } from '@websocket/gateways/presence.gateway';
import { PresenceService } from './presence.service';
import {
  Presence,
  PresenceSchema,
} from './schemas/presence.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Presence.name, schema: PresenceSchema },
    ]),
    forwardRef(() => WebSocketModule),
  ],
  providers: [PresenceGateway, PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
