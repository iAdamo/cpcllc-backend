export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  deliveredTo: string[];
  readBy: string[];
  metadata?: Record<string, any>;
  replyTo?: string;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  SYSTEM = 'system',
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: string[];
  name?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: Message;
  metadata?: Record<string, any>;
}

export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
  CHANNEL = 'channel',
}

export interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: Date;
  deviceId: string;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

// DTOs for event payloads
// export class SendMessageDto {
//   chatId: string;
//   content: string;
//   type: MessageType;
//   replyTo?: string;
//   metadata?: Record<string, any>;
// }

export interface SendMessageDto {
  chatId: string;
  senderId: string;
  type: MessageType;
  content?: {
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    size?: number;
    duration?: number;
    fileName?: string;
  };
  replyTo?: string;
  metadata?: Record<string, any>;
}

export class MarkAsReadDto {
  messageIds: string[];
  chatId: string;
}

export class TypingDto {
  chatId: string;
  isTyping: boolean;
}

export class JoinChatDto {
  chatId: string;
}
