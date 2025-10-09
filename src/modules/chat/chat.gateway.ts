import * as jwt from 'jsonwebtoken';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UseFilters,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { Types } from 'mongoose';
import { WsJwtGuard, JwtAuthGuard } from '@modules/jwt/jwt.guard';

interface AuthenticatedSocket extends Socket {
  userId: Types.ObjectId;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
  path: '/sanuxsocket/socket.io',
})
@UseGuards(WsJwtGuard)
@UsePipes(new ValidationPipe({ transform: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> socketIds

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.split(' ')[1];
    if (!token) {
      this.logger.error(`Client connection rejected: No token provided`);
      client.disconnect();
      return;
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET) as {
        sub: string;
        email: string;
      };
      client.userId = new Types.ObjectId(payload.sub);
    } catch (error) {
      this.logger.error(`Client connection rejected: Invalid token`);
      client.disconnect();
      return;
    }

    const userId = client.userId?.toString();
    if (!userId) {
      client.disconnect();
      return;
    }

    client.userId = new Types.ObjectId(userId);

    // Track user sockets
    const userIdStr = userId.toString();
    if (!this.userSockets.has(userIdStr)) {
      this.userSockets.set(userIdStr, new Set());
    }
    this.userSockets.get(userIdStr).add(client.id);

    this.logger.log(`Client connected: ${client.id}, User: ${userIdStr}`);

    // Join user to their personal room
    client.join(userIdStr);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userIdStr = client.userId?.toString();
    if (userIdStr && this.userSockets.has(userIdStr)) {
      const userSockets = this.userSockets.get(userIdStr);
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(userIdStr);

        await this.chatService.updateLastSeen(userIdStr, new Date());
        this.logger.log(`User ${userIdStr} is now offline`);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_chats')
  async handleJoinChats(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() chatIds: string[],
  ): Promise<void> {
    chatIds.forEach((chatId) => {
      client.join(chatId);
    });
    this.logger.log(
      `User ${client.userId} joined chats: ${chatIds.join(', ')}`,
    );
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      chatId: string;
      type: string;
      content?: any;
      replyTo?: string;
    },
  ): Promise<void> {
    try {
      const message = await this.chatService.sendMessage({
        chatId: new Types.ObjectId(data.chatId),
        senderId: client.userId,
        type: data.type as any,
        content: data.content,
        replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
      });

      // Emit to all participants in the chat
      this.server.to(data.chatId).emit('new_message', {
        message: await message.populate(
          'senderId',
          'firstName lastName profilePicture',
        ),
      });

      // Send notifications to offline users
      await this.notifyOfflineUsers(data.chatId, message);
    } catch (error) {
      this.logger.error('Error sending message:', error);
      client.emit('message_error', { error: error });
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ): Promise<void> {
    client.to(data.chatId).emit('user_typing', {
      userId: client.userId,
      chatId: data.chatId,
      typing: true,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ): Promise<void> {
    client.to(data.chatId).emit('user_typing', {
      userId: client.userId,
      chatId: data.chatId,
      typing: false,
    });
  }

  @SubscribeMessage('mark_delivered')
  async handleMarkDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ): Promise<void> {
    await this.chatService.markMessagesAsDelivered(
      new Types.ObjectId(data.chatId),
      client.userId,
    );

    // Notify others that user has seen messages
    client.to(data.chatId).emit('messages_delivered', {
      userId: client.userId,
      chatId: data.chatId,
    });
  }

  private async notifyOfflineUsers(
    chatId: string,
    message: any,
  ): Promise<void> {
    // Get chat participants
    const chat = await this.chatService['chatModel']
      .findById(chatId)
      .populate('participants', '_id')
      .exec();

    if (!chat) return;

    const participants = chat.participants.map((p) => p._id.toString());

    // Find offline participants (not in userSockets)
    const offlineUsers = participants.filter(
      (userId) =>
        !this.userSockets.has(userId) ||
        this.userSockets.get(userId).size === 0,
    );

    // Here you would integrate with your push notification service
    // For now, we'll just log
    if (offlineUsers.length > 0) {
      this.logger.log(
        `Should send push notifications to: ${offlineUsers.join(', ')}`,
      );
    }
  }

  // Utility method to get online status
  isUserOnline(userId: string): boolean {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
  }

  @SubscribeMessage('check_online')
  handleCheckOnline(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string },
  ) {
    const online = this.isUserOnline(data.userId);
    this.logger.log(`Checked online status for ${data.userId}: ${online}`);
    client.emit('online_status', { userId: data.userId, online });
  }

  @SubscribeMessage('leave_chats')
  async handleLeaveChats(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() chatIds: string[],
  ): Promise<void> {
    chatIds.forEach((chatId) => {
      client.leave(chatId);
    });
    this.logger.log(`User ${client.userId} left chats: ${chatIds.join(', ')}`);
  }
}
