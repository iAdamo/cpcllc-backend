import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import {
  NotificationChannel,
  NotificationCategory,
  NotificationStatus,
  NotificationPriority,
  ActionType,
} from '../interfaces/notification.interface';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ index: true })
  tenantId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({
    type: String,
    enum: Object.values(NotificationCategory),
    required: true,
    index: true,
  })
  category: NotificationCategory;

  @Prop({
    type: String,
    enum: Object.values(NotificationPriority),
    default: NotificationPriority.NORMAL,
  })
  priority: NotificationPriority;

  @Prop({
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Prop()
  actionUrl: string;

  @Prop({
    type: String,
    enum: Object.values(ActionType),
  })
  actionType: ActionType;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop({
    type: [String],
    enum: Object.values(NotificationChannel),
    default: [NotificationChannel.IN_APP],
  })
  channels: NotificationChannel[];

  @Prop({
    type: [
      {
        channel: {
          type: String,
          enum: Object.values(NotificationChannel),
          required: true,
        },
        status: {
          type: String,
          enum: ['PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED'],
          default: 'PENDING',
        },
        messageId: String,
        error: String,
        sentAt: Date,
        deliveredAt: Date,
        retryCount: { type: Number, default: 0 },
      },
    ],
    default: [],
  })
  deliveries: Array<{
    channel: NotificationChannel;
    status: string;
    messageId?: string;
    error?: string;
    sentAt?: Date;
    deliveredAt?: Date;
    retryCount: number;
  }>;

  @Prop()
  readAt: Date;

  @Prop()
  expiresAt: Date;

  @Prop()
  scheduledAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Compound indexes for efficient querying
NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1 });
NotificationSchema.index({ userId: 1, readAt: 1 });
NotificationSchema.index({ tenantId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days
NotificationSchema.index({ scheduledAt: 1 }, { expireAfterSeconds: 0 }); // TTL for scheduled
