import { Last } from './../../../../node_modules/socket.io/dist/typed-events.d';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CreateChatDto } from '../dto/create-chat.dto';
export type ChatDocument = HydratedDocument<Chat>;

class LastMessage {
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  messageId: Types.ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ required: true })
  createdAt: Date;
}

@Schema({ timestamps: true, collection: 'chats' })
export class Chat {
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    required: true,
  })
  participants: Types.ObjectId[]; // Should always be length 2

  @Prop({ type: LastMessage })
  lastMessage?: LastMessage;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// Compound indexes for better query performance
ChatSchema.index({ participants: 1 });
ChatSchema.index({ 'lastMessage.createdAt': -1 });
