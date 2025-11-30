import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { User, UserSchema } from '@modules/schemas/user.schema';
import { Chat, ChatSchema } from './schemas/chat.schema';
import { Provider, ProviderSchema } from '@modules/schemas/provider.schema';
import { Presence, PresenceSchema } from './schemas/presence.schema';
import { JobPost, JobPostSchema } from '@modules/schemas/job.schema';
import { Proposal, ProposalSchema } from '@modules/schemas/proposal.schema';
import { CacheModule } from '@modules/cache.module';
import { ChatController } from './chat.controller';
import { DbStorageService } from 'src/common/utils/dbStorage';
import { NotificationService } from '../notification/notification.service';
import { NotificatonModule } from '../notification/notification.module';
import { Notification, NotificationSchema } from '@schemas/notification.schema';
import {
  UserPreference,
  UserPreferenceSchema,
} from '@schemas/user-preference.schema';
import { PreferencesService } from '@controllers/preferences.service';
import { InAppAdapter, PushAdapter, EmailAdapter } from '../notification/adapters';

@Module({
  imports: [
    CacheModule,
    NotificatonModule,
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Presence.name, schema: PresenceSchema },
      { name: JobPost.name, schema: JobPostSchema },
      { name: Proposal.name, schema: ProposalSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: UserPreference.name, schema: UserPreferenceSchema },
    ]),
  ],
  providers: [
    ChatService,
    ChatGateway,
    DbStorageService,
    NotificationService,
    PreferencesService,
    InAppAdapter,
    PushAdapter,
    EmailAdapter,
  ],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
