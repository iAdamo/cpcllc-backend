export interface Message {
  id: string;
  conversationId: string;
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
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: Date;
}

// DTOs for event payloads
export class SendMessageDto {
  conversationId: string;
  content: string;
  type: MessageType;
  replyTo?: string;
  metadata?: Record<string, any>;
}

export class MarkAsReadDto {
  messageIds: string[];
  conversationId: string;
}

export class TypingDto {
  conversationId: string;
  isTyping: boolean;
}

export class JoinConversationDto {
  conversationId: string;
}
