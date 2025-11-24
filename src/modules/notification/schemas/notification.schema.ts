import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import {
  NotificationCategory,
  ActionType,
  NotificationChannel,
  NotificationPayload,
  NotificationStatus,
} from '../interfaces/notification.interface';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, index: true })
  tenantId?: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  body: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationCategory),
    required: true,
    index: true,
  })
  category: NotificationCategory;

  @Prop({ type: String })
  actionUrl?: string;

  @Prop({ type: String, enum: Object.values(ActionType) })
  actionType?: ActionType;

  @Prop({ type: Object })
  meta?: Record<string, any>;

  @Prop({
    type: [String],
    enum: Object.values(NotificationChannel),
    required: true,
  })
  channels: NotificationChannel[];

  @Prop({
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.PENDING,
    index: true,
  })
  status: NotificationStatus;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ type: Date })
  deliveredAt?: Date;

  @Prop({ type: Date, index: { expireAfterSeconds: 0 } })
  expiresAt?: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ userId: 1, readAt: 1 }); // For unread notifications
