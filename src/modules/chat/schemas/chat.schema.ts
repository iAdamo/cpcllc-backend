import { plainToClass } from 'class-transformer';
import { compile } from 'handlebars';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
// export type ChatDocument = HydratedDocument<Chat>;

// class LastMessage {
//   @Prop({ type: Types.ObjectId, ref: 'Message' })
//   messageId: Types.ObjectId;

//   @Prop({ required: true })
//   text: string;

//   @Prop({ type: Types.ObjectId, ref: 'User', required: true })
//   sender: Types.ObjectId;

//   @Prop({ required: true })
//   createdAt: Date;
// }

// @Schema({ timestamps: true })
// export class Chat {
//   @Prop({
//     type: [{ type: Types.ObjectId, ref: 'User' }],
//     required: true,
//   })
//   participants: Types.ObjectId[]; // Should always be length 2

//   @Prop({ type: LastMessage })
//   lastMessage?: LastMessage;

//   // unread count for each participant
//   @Prop({ type: Map, of: Number, default: new Map() })
//   unreadCounts: Map<string, number>;

//   @Prop({ default: true })
//   isActive: boolean;

//   @Prop()
//   createdAt: Date;

//   @Prop()
//   updatedAt: Date;
// }

// export const ChatSchema = SchemaFactory.createForClass(Chat);

// // Compound indexes for better query performance
// ChatSchema.index({ participants: 1 });
// ChatSchema.index({ 'lastMessage.createdAt': -1 });

// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { HydratedDocument, Types } from 'mongoose';

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

@Schema({ timestamps: true })
export class Chat {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  initiatorUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  providerUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true })
  providerId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  participantUserIds: Types.ObjectId[];

  @Prop({ enum: ['direct', 'group'], default: 'direct' })
  type: 'direct' | 'group';

  @Prop({ type: LastMessage })
  lastMessage?: LastMessage;

  @Prop({ type: Map, of: Number, default: new Map() })
  unreadCounts: Map<string, number>;

  @Prop({ default: true })
  isActive: boolean;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

ChatSchema.index({ clientUserId: 1, providerId: 1 }, { unique: true });
ChatSchema.index({ clientUserId: 1, isActive: 1 });
ChatSchema.index({ providerUserId: 1, isActive: 1 });
ChatSchema.index({ updatedAt: -1 });
ChatSchema.index({ 'lastMessage.createdAt': -1 });
