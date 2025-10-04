// chat.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument, MessageType } from '@schemas/message.schema';
import { User, UserDocument } from '@modules/schemas/user.schema';
import { CreateChatDto } from './dto/create-chat.dto';

// interface CreateChatDto {
//   participants: Types.ObjectId[];
// }

interface SendMessageDto {
  chatId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: MessageType;
  content?: {
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    size?: number;
    duration?: number;
    fileName?: string;
  };
  replyTo?: Types.ObjectId;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createChat(
    currentUserId: string,
    createChatDto: CreateChatDto,
    session?: ClientSession,
  ): Promise<ChatDocument> {
    const { participants } = createChatDto;
    if (!participants || participants.length !== 1) {
      throw new BadRequestException(
        'Direct chat must have exactly 1 other participant',
      );
    }

    const user = new Types.ObjectId(currentUserId);
    const provider = new Types.ObjectId(participants[0]);

    console.log(user, provider);

    // if (await this.userModel.exists({ _id: user, activeRoleId: provider })) {
    //   throw new BadRequestException('User and provider cannot be the same');
    // }

    const userExists = await this.userModel.exists({ _id: user });
    const providerExists = await this.userModel.exists({
      activeRoleId: provider,
    });
    if (!userExists || !providerExists) {
      throw new NotFoundException('One or more participants not found');
    }
    // Check for existing chat between the two participants
    let chat = await this.chatModel.findOne({
      participants: { $all: [user, provider], $size: 2 },
      isActive: true,
    });

    if (chat) {
      return chat;
    }

    // Create new chat
    chat = new this.chatModel({
      participants: [user, provider],
      isActive: true,
    });
    await chat.save({ session });
    this.logger.log(
      `Chat created between user ${user} and provider ${provider}`,
    );
    return chat;

    // // Validate participants
    // if (participants.length !== 2) {
    //   throw new BadRequestException(
    //     'Direct chat must have exactly 2 participants',
    //   );
    // }

    // // Check if direct chat already exists
    // const existingChat = await this.chatModel.findOne({
    //   participants: { $all: participants, $size: 2 },
    //   isActive: true,
    // });
    // if (existingChat) {
    //   return existingChat;
    // }

    // const chatData: any = {
    //   participants,
    //   isActive: true,
    // };

    // const chat = new this.chatModel(chatData);
    // return chat.save({ session });
  }

  async sendMessage(
    sendMessageDto: SendMessageDto,
    session?: ClientSession,
  ): Promise<MessageDocument> {
    const { chatId, senderId, type, content, replyTo } = sendMessageDto;

    // Verify chat exists and sender is participant
    const chat = await this.chatModel.findOne({
      _id: chatId,
      participants: senderId,
      isActive: true,
    });

    if (!chat) {
      throw new NotFoundException('Chat not found or user not participant');
    }

    // Validate replyTo message exists if provided
    if (replyTo) {
      const repliedMessage = await this.messageModel.findOne({
        _id: replyTo,
        chatId,
      });
      if (!repliedMessage) {
        throw new NotFoundException('Replied message not found');
      }
    }

    const messageData: any = {
      chatId,
      senderId,
      type,
      content,
      status: {
        sent: true,
        delivered: [],
        read: [],
      },
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new this.messageModel(messageData);
    const savedMessage = await message.save({ session });

    // Update last message in chat
    await this.updateChatLastMessage(chatId, savedMessage, session);

    this.logger.log(`Message sent: ${savedMessage._id} in chat: ${chatId}`);
    return savedMessage;
  }

  private async updateChatLastMessage(
    chatId: Types.ObjectId,
    message: MessageDocument,
    session?: ClientSession,
  ): Promise<void> {
    const lastMessage = {
      messageId: message._id,
      text: this.getMessagePreview(message),
      sender: message.senderId,
      createdAt: message.createdAt,
    };

    await this.chatModel.updateOne(
      { _id: chatId },
      { lastMessage },
      { session },
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
  ): Promise<ChatDocument[]> {
    const skip = (page - 1) * limit;

    return this.chatModel
      .find({
        participants: userId,
        isActive: true,
      })
      .populate('participants', 'username avatarUrl')
      .populate('lastMessage.sender', 'username')
      .sort({ 'lastMessage.createdAt': -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async getChatMessages(
    chatId: Types.ObjectId,
    userId: Types.ObjectId,
    page: number = 1,
    limit: number = 100,
  ): Promise<MessageDocument[]> {
    // Verify user is participant
    const chat = await this.chatModel.findOne({
      _id: chatId,
      participants: userId,
      isActive: true,
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const skip = (page - 1) * limit;

    return this.messageModel
      .find({
        chatId,
        deleted: false,
      })
      .populate('senderId', 'username avatarUrl')
      .populate('replyTo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
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
}
