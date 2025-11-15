import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ enum: ['Message', 'JobUpdate', 'Promotion'], required: true })
  type: string;

  // payload can reference different entities based on type
  @Prop({ type: Types.ObjectId, refPath: 'type', required: true })
  payloadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ default: false })
  sent: boolean;

  @Prop({ default: null })
  actionUrl: string;

  @Prop({ default: null })
  metaData: Record<string, any>;

  @Prop({ default: null })
  tenantId: Types.ObjectId;

  @Prop({ default: false })
  read: boolean;

  @Prop({ default: false })
  archived: boolean;

  @Prop({ default: null })
  readAt: Date;

  @Prop({ default: Date.now })
  expiresAt: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
