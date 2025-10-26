import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { User, UserSchema } from '@modules/schemas/user.schema';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { Presence, PresenceSchema } from './schemas/presence.schema';
import { CacheModule } from '@modules/cache.module';
import { ChatController } from './chat.controller';
import { DbStorageService } from 'src/common/utils/dbStorage';

@Module({
  imports: [
    CacheModule,
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Presence.name, schema: PresenceSchema },
    ]),
  ],
  providers: [ChatService, ChatGateway, DbStorageService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
