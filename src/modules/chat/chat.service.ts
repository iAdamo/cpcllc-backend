import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession, FlattenMaps } from 'mongoose';
import { Provider, ProviderDocument } from '@modules/schemas/provider.schema';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument } from '@schemas/message.schema';
import { User, UserDocument } from '@modules/schemas/user.schema';
import { Proposal, ProposalDocument } from '@schemas/proposal.schema';
import { JobPost, JobPostDocument } from '@schemas/job.schema';
import { CreateChatDto } from './dto/create-chat.dto';
import { format, isToday, isYesterday } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { DbStorageService } from 'src/common/utils/dbStorage';
import { AppGateway } from '../websocket/gateways/app.gateway';
import { ChatEvents } from '../websocket/events/chat.events';
import { SocketManagerService } from '@websocket/services/socket-manager.service';
import {
  TypingDto,
  MessageType,
  SendMessageDto,
  JoinChatDto,
} from './interfaces/chat.interface';
import { PRESENCE_STATUS } from '@presence/interfaces/presence.interface';

type LeanMessage = FlattenMaps<MessageDocument> & { _id: Types.ObjectId };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Proposal.name)
    private proposalModel: Model<ProposalDocument>,
    @InjectModel(JobPost.name) private jobPostModel: Model<JobPostDocument>,
    private readonly storage: DbStorageService,
    private readonly appGateway: AppGateway,
    private readonly socketManager: SocketManagerService,
  ) {}

  private async chatEligibilyStatus(
    currentUserId: Types.ObjectId,
    otherUserId: Types.ObjectId,
  ) {
    // get the other user provider id
    const otherUser = await this.userModel
      .findById(otherUserId)
      .select('activeRoleId')
      .lean();
    if (!otherUser) {
      throw new NotFoundException('The other user does not exist');
    }
    if (!otherUser.activeRoleId) {
      throw new BadRequestException('Can only initiate chat with providers');
    }
    // Check if current user follows the provider
    const isFollowing = await this.userModel.exists({
      _id: currentUserId,
      followedProviders: otherUser.activeRoleId,
    });
    if (isFollowing) return true;

    const jobs = await this.jobPostModel
      .find({ userId: currentUserId })
      .select('_id')
      .lean();
    if (!jobs.length) return false;

    const jobIds = jobs.map((j: any) => j._id);

    const accepted = await this.proposalModel
      .findOne({
        providerId: otherUserId,
        status: 'accepted',
        jobId: { $in: jobIds },
      })
      .lean();

    if (accepted) return true;

    return false;
  }

  async createChat(
    currentUserId: string,
    createChatDto: CreateChatDto,
    session?: ClientSession,
  ) {
    const { participants } = createChatDto;
    if (!participants) {
      throw new BadRequestException(
        'Direct chat must have exactly 1 other participant',
      );
    }

    const user = new Types.ObjectId(currentUserId);
    const otherUser = new Types.ObjectId(participants);

    if (user.equals(otherUser)) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    // Ensure both users exist
    const usersExists = await this.userModel
      .find({ _id: { $in: [user, otherUser] } })
      .countDocuments();
    if (usersExists !== 2) {
      throw new NotFoundException('One or more participants not found');
    }

    if (!(await this.chatEligibilyStatus(user, otherUser))) {
      throw new BadRequestException(
        'You must follow the provider to initiate chat',
      );
    }

    // Check for existing chat between the two participants
    let chat = await this.chatModel.findOne({
      participants: { $all: [user, otherUser], $size: 2 },
      isActive: true,
    });

    if (!chat) {
      // Create new chat
      chat = new this.chatModel({
        participants: [user, otherUser],
        isActive: true,
      });
      await chat.save({ session });
      this.logger.log(
        `Chat created between user ${user} and provider ${otherUser}`,
      );
    }
    return this.populatedChat(user);
  }

  async joinChat(
    userId: string,
    chatId: string,
    session?: ClientSession,
  ): Promise<void> {
    const user = new Types.ObjectId(userId);

    // Check for existing chat between the two participants
    let chat = await this.chatModel.findOne({
      _id: new Types.ObjectId(chatId),
      participants: new Types.ObjectId(userId),
      isActive: true,
    });

    if (!chat) {
      throw new NotFoundException(
        'Conversation not found or user not participant',
      );
    }

    const sockets = await this.socketManager.getUserSockets({ userId });
    console.log({ sockets });
    for (const socketId of sockets) {
      this.appGateway.server.sockets.sockets.get(socketId)?.join(chatId);
    }
    this.logger.log(`User ${userId} joined conversation ${chatId}`);
  }

  async uploadFile(email: string, files: { file: Express.Multer.File[] }) {
    return this.storage.handleFileUploads(
      `${email}/chats/${Date.now()}`,
      files,
    );
  }

  async sendMessage(
    sendMessageDto: SendMessageDto,
    session?: ClientSession,
  ): Promise<MessageDocument> {
    const { chatId, senderId, type, content, replyTo } = sendMessageDto;
    //  const message = await this.chatService.sendMessage({
    //    chatId: new Types.ObjectId(data.chatId),
    //    senderId: client.userId,
    //    type: data.type as any,
    //    content: data.content,
    //    replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
    //  });
    // Verify chat exists and sender is participant
    const chat = await this.chatModel.findOne({
      _id: new Types.ObjectId(chatId),
      participants: senderId,
      isActive: true,
    });

    if (!chat) {
      throw new NotFoundException('Chat not found or user not participant');
    }

    // Validate replyTo message exists if provided
    if (replyTo) {
      const repliedMessage = await this.messageModel.findOne({
        _id: new Types.ObjectId(replyTo),
        chatId,
      });
      if (!repliedMessage) {
        throw new NotFoundException('Replied message not found');
      }
    }

    const messageData: any = {
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(senderId),
      type,
      content,
      status: {
        sent: true,
        delivered: [],
        read: [],
      },
    };

    if (replyTo) {
      messageData.replyTo = new Types.ObjectId(replyTo);
    }

    const message = new this.messageModel(messageData);
    await message.save({ session });

    // Update last message in chat
    const lastMessage = {
      messageId: message._id,
      text: this.getMessagePreview(message),
      sender: message.senderId,
      createdAt: message['createdAt'],
    };

    await this.chatModel.updateOne(
      { _id: chatId },
      { lastMessage },
      { session },
    );

    this.logger.log(`Message sent: ${message._id} in chat: ${chatId}`);

    await this.broadcastToChat(
      chatId.toString(),
      ChatEvents.MESSAGE_SENT,
      message,
    );

    return message;
  }
  /**
   * Handle typing indicators
   */
  async handleTyping(userId: string, dto: TypingDto): Promise<void> {
    const event = dto.isTyping
      ? ChatEvents.TYPING_START
      : ChatEvents.TYPING_STOP;

    await this.broadcastToChat(
      dto.chatId,
      event,
      {
        userId,
        chatId: dto.chatId,
        timestamp: new Date(),
      },
      userId, // Exclude the typing user
    );

    this.logger.debug(
      `Typing ${dto.isTyping ? 'started' : 'stopped'} by ${userId} in ${dto.chatId}`,
    );
  }

  private getMessagePreview(message: MessageDocument): string {
    switch (message.type) {
      case MessageType.TEXT:
        return message.content?.text || '';
      case MessageType.IMAGE:
        return '📷 Image';
      case MessageType.VIDEO:
        return '🎥 Video';
      case MessageType.AUDIO:
        return '🎵 Audio';
      case MessageType.FILE:
        return '📄 File';
      case MessageType.SYSTEM:
        return '⚡ System message';
      default:
        return 'Message';
    }
  }

  async getUserChats(
    userId: Types.ObjectId,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('Inactive users cannot access chats');
    }

    let query: any = {
      participants: userId,
      isActive: true,
    };

    if (user.activeRole === 'Client') {
      query['participants.0'] = userId;
    } else if (user.activeRole === 'Provider') {
      query['participants.0'] = { $ne: userId };
    }

    return this.populatedChat(userId, skip, limit, query);
  }

  /**
   * Leave conversation room
   */
  async leaveConversation(userId: string, chatId: string): Promise<void> {
    const sockets = await this.socketManager.getUserSockets({ userId });

    for (const socketId of sockets) {
      this.appGateway.server.sockets.sockets.get(socketId)?.leave(chatId);
    }

    this.logger.log(`User ${userId} left conversation ${chatId}`);
  }

  async getChatMessages(
    chatId: Types.ObjectId,
    userId: Types.ObjectId,
    page = 1,
    limit = 100,
    userTimezone = 'Africa/Lagos',
  ): Promise<{ title: string; data: LeanMessage[] }[]> {
    const chat = await this.chatModel.findOne({
      _id: chatId,
      participants: userId,
      isActive: true,
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ chatId, deleted: false })
      .populate('senderId', 'username profilePicture')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const grouped = messages.reduce(
      (acc, message) => {
        const localDate = toZonedTime(message['createdAt'], userTimezone);

        let title: string;
        if (isToday(localDate)) title = 'Today';
        else if (isYesterday(localDate)) title = 'Yesterday';
        else title = format(localDate, 'MMM d, yyyy');

        if (!acc[title]) acc[title] = [];
        acc[title].push(message);

        return acc;
      },
      {} as Record<string, LeanMessage[]>,
    );

    // --- Sort and format to SectionList structure ---
    const sections = Object.keys(grouped)
      .sort((a, b) => {
        const parse = (label: string) => {
          if (label === 'Today') return new Date();
          if (label === 'Yesterday')
            return new Date(Date.now() - 24 * 60 * 60 * 1000);
          return new Date(label);
        };
        return parse(b).getTime() - parse(a).getTime();
      })
      .map((title) => ({
        title,
        data: grouped[title],
      }));

    return sections;
  }

  async markMessagesAsDelivered(
    chatId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    await this.messageModel.updateMany(
      {
        chatId,
        'status.delivered': { $ne: userId },
        senderId: { $ne: userId }, // Don't mark own messages as delivered
      },
      {
        $addToSet: { 'status.delivered': userId },
      },
    );
  }

  async deleteMessage(
    messageId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<void> {
    const message = await this.messageModel.findOne({
      _id: messageId,
      senderId: userId,
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Soft delete
    message.deleted = true;
    message.deletedAt = new Date();
    await message.save();
  }

  /**
   * Get conversation participants
   */
  async getChatParticipants(chatId: string): Promise<Types.ObjectId[]> {
    const chat = await this.chatModel.findById(new Types.ObjectId(chatId));
    return chat?.participants || [];
  }

  /**
   * Broadcast to all participants in a conversation
   */
  private async broadcastToChat(
    chatId: string,
    event: string,
    data: any,
    excludeUserId?: string,
  ): Promise<void> {
    const participants = await this.getChatParticipants(chatId);

    for (const participantId of participants) {
      if (participantId.toString() !== excludeUserId) {
        await this.appGateway.sendToUser(participantId.toString(), event, data);
      }
    }
  }

  private async populatedChat(
    userId: Types.ObjectId,
    skip?: number,
    limit?: number,
    query?: any,
  ) {
    return await this.chatModel
      .find(query)
      .populate({
        path: 'participants',
        model: 'User',
        select: 'firstName lastName profilePicture',
        match: { _id: { $ne: userId } },
        populate: [
          {
            path: 'followedProviders',
            model: 'Provider',
            select: 'providerName providerLogo',
          },
          {
            path: 'activeRoleId',
            model: 'Provider',
            match: { _id: { $ne: userId } },
            populate: {
              path: 'subcategories',
              model: 'Subcategory',
              select: 'name description',
              populate: {
                path: 'categoryId',
                model: 'Category',
                select: 'name description',
              },
            },
          },
        ],
      })
      // .populate('lastMessage.sender', 'firstName lastName')
      // .sort({ 'lastMessage.createdAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
}
