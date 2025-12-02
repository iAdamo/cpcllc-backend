import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import {
  NotificationChannel,
  NotificationCategory,
  NotificationStatus,
} from '../interfaces/notification.interface';

export type NotificationLogDocument = HydratedDocument<NotificationLog>;

@Schema({ timestamps: true })
export class NotificationLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true,
  })
  notificationId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ index: true })
  tenantId: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationChannel),
    required: true,
  })
  channel: NotificationChannel;

  @Prop({
    type: String,
    enum: Object.values(NotificationCategory),
    required: true,
  })
  category: NotificationCategory;

  @Prop({
    type: String,
    enum: ['success', 'failed', 'skipped'],
    required: true,
  })
  result: string;

  @Prop()
  error: string;

  @Prop()
  messageId: string;

  @Prop({ type: Object })
  meta: Record<string, any>;

  @Prop()
  deliveredAt: Date;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop()
  createdAt: Date;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);

// Indexes for analytics and debugging
NotificationLogSchema.index({ userId: 1, deliveredAt: -1 });
NotificationLogSchema.index({ channel: 1, result: 1 });
NotificationLogSchema.index({ category: 1, deliveredAt: -1 });
NotificationLogSchema.index(
  { deliveredAt: 1 },
  { expireAfterSeconds: 7776000 },
); // 90 days retention
