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
  MarkAsReadDto,
} from './interfaces/chat.interface';
import { PRESENCE_STATUS } from '@presence/interfaces/presence.interface';
import { NotificationService } from '@notification/services/notification.service';
import { PresenceService } from '@presence/presence.service';
import { PresenceStatus } from '@presence/interfaces/presence.interface';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  CreateNotificationDto,
  ActionType,
} from '@notification/interfaces/notification.interface';
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
    private readonly notificationService: NotificationService,
    private readonly presenceService: PresenceService,
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
    dto: CreateChatDto,
    session?: ClientSession,
  ) {
    const initiatorUserId = new Types.ObjectId(currentUserId);
    const providerUserId = new Types.ObjectId(dto.participants);

    if (initiatorUserId.equals(providerUserId)) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    const initiator = await this.userModel.findById(initiatorUserId);
    const providerUser = await this.userModel.findById(providerUserId);

    if (!initiator || !providerUser) {
      throw new NotFoundException('User not found');
    }

    // 🔒 RULE: only clients can initiate chats
    if (initiator.activeRole !== 'Client') {
      throw new BadRequestException('Only clients can initiate conversations');
    }

    if (!providerUser.activeRoleId) {
      throw new BadRequestException('Target user is not a provider');
    }

    const providerId = providerUser.activeRoleId;

    // Eligibility check
    const eligible = await this.chatEligibilyStatus(
      initiatorUserId,
      providerUserId,
    );

    if (!eligible) {
      throw new BadRequestException(
        'You must follow the provider to initiate chat',
      );
    }

    // 🔎 Unique lookup by (client + providerId)
    let chat = await this.chatModel.findOne({
      clientUserId: initiatorUserId,
      providerId,
      isActive: true,
    });

    if (!chat) {
      chat = new this.chatModel({
        initiatorUserId,
        clientUserId: initiatorUserId,
        providerUserId,
        providerId,
        type: 'direct',
        isActive: true,
      });

      await chat.save({ session });

      this.logger.log(
        `Chat created: client=${initiatorUserId} provider=${providerId}`,
      );
    }

    // return this.populatedChat(initiatorUserId, undefined, undefined, {
    //   _id: chat._id,
    // });

    return chat.populate([
      {
        path: 'clientUserId',
        select: 'firstName lastName profilePicture',
      },
      {
        path: 'providerUserId',
        select: 'firstName lastName profilePicture activeRoleId',
        populate: {
          path: 'activeRoleId',
          model: 'Provider',
          select: 'providerName providerLogo',
        },
      },
    ]);
  }

  async joinChat(userId: string, chatId: string): Promise<void> {
    const uid = new Types.ObjectId(userId);

    const chat = await this.chatModel.findOne({
      _id: new Types.ObjectId(chatId),
      isActive: true,
      $or: [
        { clientUserId: uid },
        { providerUserId: uid },
        { participantUserIds: uid },
      ],
    });

    if (!chat) {
      throw new NotFoundException('Conversation not found or access denied');
    }

    const sockets = await this.socketManager.getUserSockets({ userId });

    for (const socketId of sockets) {
      this.appGateway.server.sockets.sockets.get(socketId)?.join(chatId);
    }
  }

  async uploadFile(email: string, files: { file: Express.Multer.File[] }) {
    return this.storage.handleFileUploads(
      `${email}/chats/${Date.now()}`,
      files,
    );
  }

  async sendMessage(
    dto: SendMessageDto,
    session?: ClientSession,
  ): Promise<void> {
    const { chatId, senderId, type, content, replyTo } = dto;

    const sender = new Types.ObjectId(senderId);
    try {
      const chat = await this.chatModel.findOne({
        _id: new Types.ObjectId(chatId),
        isActive: true,
        $or: [
          { clientUserId: sender },
          { providerUserId: sender },
          { participantUserIds: sender },
        ],
      });

      if (!chat) {
        throw new NotFoundException('Chat not found or access denied');
      }

      const message = new this.messageModel({
        chatId: new Types.ObjectId(chatId),
        senderId: sender,
        type,
        content,
        replyTo,
        status: { sent: true, delivered: [], read: [] },
      });

      await message.save({ session });

      // Update last message
      chat.lastMessage = {
        messageId: message._id,
        text: this.getMessagePreview(message),
        sender,
        createdAt: message['createdAt'],
      };

      // Update unread counts
      const receivers = [
        chat.clientUserId,
        chat.providerUserId,
        ...(chat.participantUserIds || []),
      ];

      for (const uid of receivers) {
        const id = uid.toString();
        if (id !== senderId) {
          chat.unreadCounts.set(id, (chat.unreadCounts.get(id) || 0) + 1);

          const data: CreateNotificationDto = {
            userId: id,
            title: 'New Message',
            body: message.content.text,
            category: NotificationCategory.MESSAGE,
            priority: NotificationPriority.NORMAL,
            channels: [NotificationChannel.PUSH],
            actionType: ActionType.OPEN_CHAT,
            actionUrl: chatId,
          };
          await this.notificationService.create(data);
        }
      }

      await chat.save({ session });

      await this.broadcastToChat(chat._id.toString(), ChatEvents.MESSAGE_SENT, {
        message,
        chat,
      });
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw error;
    }
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

  async getUserChats(userId: Types.ObjectId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid user');
    }

    let query: any;

    if (user.activeRole === 'Client') {
      query = {
        clientUserId: userId,
        isActive: true,
      };
    } else {
      query = {
        providerUserId: userId,
        isActive: true,
      };
    }

    return this.chatModel
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'clientUserId', select: 'firstName lastName profilePicture' },
        {
          path: 'providerUserId',
          select: 'firstName lastName profilePicture activeRoleId',
          populate: {
            path: 'activeRoleId',
            model: 'Provider',
            select: 'providerName providerLogo',
          },
        },
      ])
      .lean();
  }

  async getChatById(userId: Types.ObjectId, chatId: string) {
    const user = await this.userModel.findById(userId);

    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid user');
    }

    const baseQuery: any = {
      _id: chatId,
      isActive: true,
    };

    if (user.activeRole === 'Client') {
      baseQuery.clientUserId = userId;
    } else {
      baseQuery.providerUserId = userId;
    }

    const chat = await this.chatModel
      .findOne(baseQuery)
      .populate([
        { path: 'clientUserId', select: 'firstName lastName profilePicture' },
        {
          path: 'providerUserId',
          select: 'firstName lastName profilePicture activeRoleId',
          populate: {
            path: 'activeRoleId',
            model: 'Provider',
            select: 'providerName providerLogo',
          },
        },
      ])
      .lean();

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
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
    limit = 50,
    cursor?: Date,
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
    nextCursor: Date | null;
  }> {
    const chat = await this.chatModel.findOne({
      _id: chatId,
      isActive: true,
      $or: [{ clientUserId: userId }, { providerUserId: userId }],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found or access denied');
    }

    const query: any = {
      chatId,
      deleted: false,
    };

    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const messages = await this.messageModel
      .find(query)
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    let hasMore = false;
    let nextCursor: Date | null = null;

    if (messages.length > limit) {
      hasMore = true;
      messages.pop();
    }

    if (messages.length > 0) {
      nextCursor = messages[messages.length - 1]['createdAt'];
    }

    return {
      messages: messages.reverse(), // chronological
      hasMore,
      nextCursor,
    };
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

  /**
   * Mark messages as read by user
   */
  async markAsRead(userId: string, dto: MarkAsReadDto): Promise<void> {
    const now = new Date();
    const objIds = dto.messageIds.map(
      (messageId) => new Types.ObjectId(messageId),
    );
    const updatedMessages = await this.messageModel.updateMany(
      {
        _id: { $in: objIds },
        'status.read': { $ne: userId }, // only unread
      },
      {
        $addToSet: {
          'status.read': userId,
        },
      },
    );

    if (updatedMessages.modifiedCount === 0) {
      return;
    }

    const chat = await this.chatModel.findByIdAndUpdate(
      dto.chatId,
      {
        $set: {
          [`unreadCounts.${userId}`]: 0,
        },
      },
      { new: true },
    );

    await this.broadcastToChat(dto.chatId, ChatEvents.MESSAGE_READ, {
      chatId: chat._id,
      unreadCount: chat.unreadCounts?.get(userId) || 0,
      userId,
      readAt: now,
    });

    this.logger.log(
      `User ${userId} marked ${updatedMessages.modifiedCount} messages as read`,
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
    const chat = await this.chatModel.findById(chatId);
    if (!chat) return [];

    return [
      chat.clientUserId,
      chat.providerUserId,
      ...(chat.participantUserIds || []),
    ];
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
