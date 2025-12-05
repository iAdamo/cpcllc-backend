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
    enum: ['SENT', 'DELIVERED', 'FAILED', 'READ', 'CLICKED'],
    required: true,
  })
  action: string;

  @Prop()
  error: string;

  @Prop()
  messageId: string;
  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop()
  deviceId: string;

  @Prop()
  location: string;

  @Prop()
  processingTime: number; // in milliseconds
  @Prop()
  deliveredAt: Date;

  @Prop({ default: 0 })
  retryCount: number;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);

// Compound indexes for analytics
NotificationLogSchema.index({ userId: 1, createdAt: -1 });
NotificationLogSchema.index({ channel: 1, action: 1, createdAt: -1 });
NotificationLogSchema.index({ category: 1, createdAt: -1 });
NotificationLogSchema.index({ notificationId: 1, channel: 1 });
NotificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
