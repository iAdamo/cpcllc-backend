// message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageType } from '@controllers/interfaces/chat.interface';

class MessageContent {
  @Prop()
  text?: string;

  @Prop()
  mediaUrl?: string;

  @Prop()
  mediaType?: string; // MIME type

  @Prop()
  size?: number; // in bytes

  @Prop()
  duration?: number; // for audio/video in seconds

  @Prop()
  thumbnailUrl?: string; // for videos

  @Prop()
  fileName?: string; // for files
}

class MessageStatus {
  @Prop({ default: true })
  sent: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  delivered: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  read: Types.ObjectId[];
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true, index: true })
  chatId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ type: MessageContent })
  content?: MessageContent;

  @Prop({
    type: MessageStatus,
    default: () => ({ sent: true, delivered: [], read: [] }),
  })
  status: MessageStatus;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo?: Types.ObjectId;

  @Prop({ default: false })
  edited: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({ default: false })
  deleted: boolean;

  @Prop()
  deletedAt?: Date;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound indexes for efficient message retrieval
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, createdAt: -1 });
MessageSchema.index({ 'status.delivered': 1 });
