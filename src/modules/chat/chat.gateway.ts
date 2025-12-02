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
  Injectable,
  Logger,
  UseFilters,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { NotificationService } from '../notification/notification.service';
import { Types } from 'mongoose';
import { WsJwtGuard } from '@modules/jwt/jwt.guard';
import { EventHandler } from '@modules/interfaces/websocket.interface';
import { ChatEvents } from './chat.events';
import { EventRouterService } from '../websocket/event-router.service';
import { AuthenticatedSocket } from '@modules/interfaces/websocket.interface';
import {
  TypingDto,
  SendMessageDto,
  JoinChatDto,
} from './interfaces/chat.interface';

/**
 * Chat Gateway - Handles chat-specific WebSocket events
 * Registers itself with the central event router
 */
@Injectable()
export class ChatGateway implements EventHandler {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly handledEvents = [
    ChatEvents.SEND_MESSAGE,
    ChatEvents.MARK_AS_READ,
    ChatEvents.TYPING_INDICATOR,
    ChatEvents.JOIN_ROOM,
    ChatEvents.LEAVE_ROOM,
  ];
  // private userSockets = new Map<string, Set<string>>(); // userId -> socketIds

  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly chatService: ChatService,
  ) {}

  onModuleInit() {
    if (this.eventRouter)
      this.handledEvents.forEach((event) => {
        console.debug({ event });
        this.eventRouter.registerHandler(event, this);
      });
    // this.logger.log('Chat gateway registered with event router');
  }

  /**
   * Check if this gateway can handle the event
   */
  canHandle(event: any): boolean {
    return this.handledEvents.includes(event);
  }

  /**
   * Handle incoming chat events
   */
  async handle(
    event: string,
    data: any,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const userId = socket.user.userId;

    try {
      switch (event) {
        case ChatEvents.SEND_MESSAGE:
          await this.handleSendMessage(data, socket);
          break;

        // case ChatEvents.MARK_AS_READ:
        //   await this.handleMarkAsRead(userId, data, socket);
        //   break;

        case ChatEvents.TYPING_INDICATOR:
          await this.handleTypingIndicator(userId, data, socket);
          break;
        case ChatEvents.JOIN_ROOM:
          await this.handleJoinRoom(userId, data, socket);
          break;

        case ChatEvents.LEAVE_ROOM:
          await this.handleLeaveRoom(data, socket);
          break;

        default:
          this.logger.warn(`Unhandled chat event: ${event}`);
      }
    } catch (error) {
      this.logger.error(`Error handling chat event ${event}:`, error);
      throw error;
    }
  }

  /**
   * Handle sending new messages
   */
  private async handleSendMessage(
    // userId: string,
    data: SendMessageDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const message = await this.chatService.sendMessage(data);

    // Echo the sent message back to sender
    socket.emit(ChatEvents.MESSAGE_SENT, message);

    this.logger.debug(
      `Message sent by ${data.senderId} to conversation ${data.chatId}`,
    );
  }

  /**
   * Handle marking messages as read
   */
  // private async handleMarkAsRead(
  //   userId: string,
  //   data: MarkAsReadDto,
  //   socket: AuthenticatedSocket,
  // ): Promise<void> {
  //   await this.chatService.markAsRead(userId, data);
  // }

  /**
   * Handle typing indicators
   */
  private async handleTypingIndicator(
    userId: string,
    data: TypingDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    await this.chatService.handleTyping(userId, data);
  }

  /**
   * Handle joining conversation room
   */
  private async handleJoinRoom(
    userId: string,
    data: JoinChatDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    await this.chatService.joinChat(socket.user.userId, data.chatId);
  }

  /**
   * Handle leaving conversation room
   */
  private async handleLeaveRoom(
    data: JoinChatDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    await this.chatService.leaveConversation(socket.user.userId, data.chatId);
  }

  // @SubscribeMessage('send_message')
  // async handleSendMessage(
  //   @ConnectedSocket() client: AuthenticatedSocket,
  //   @MessageBody()
  //   data: {
  //     chatId: string;
  //     type: string;
  //     content?: any;
  //     replyTo?: string;
  //   },
  // ): Promise<void> {
  //   try {
  //     const message = await this.chatService.sendMessage({
  //       chatId: new Types.ObjectId(data.chatId),
  //       senderId: client.userId,
  //       type: data.type as any,
  //       content: data.content,
  //       replyTo: data.replyTo ? new Types.ObjectId(data.replyTo) : undefined,
  //     });

  //     // Emit to all participants in the chat
  //     this.server.to(data.chatId).emit('new_message', {
  //       message: await message.populate(
  //         'senderId',
  //         'firstName lastName profilePicture',
  //       ),
  //     });

  //     // Send notifications to offline users
  //     await this.notifyOfflineUsers(data.chatId, message);
  //   } catch (error) {
  //     this.logger.error('Error sending message:', error);
  //     client.emit('message_error', { error: error });
  //   }
  // }
}
