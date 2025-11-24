import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import {
  NotificationCategory,
  NotificationChannel,
} from '../interfaces/notification.interface';

export type UserPreferenceDocument = HydratedDocument<UserPreference>;

@Schema({ timestamps: true })
export class UserPreference {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: [String],
    enum: Object.values(NotificationChannel),
    default: Object.values(NotificationChannel),
  })
  enabledChannels: NotificationChannel[];

  @Prop({
    type: [String],
    enum: Object.values(NotificationCategory),
    default: [],
  })
  mutedCategories: NotificationCategory[];

  @Prop({
    type: {
      start: { type: String, default: '22:00' }, // HH:mm format
      end: { type: String, default: '08:00' }, // HH:mm format
      timezone: { type: String, default: 'UTC' },
    },
  })
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
  };

  @Prop({ type: [String], default: [] })
  pushTokens: string[];

  @Prop({ type: String })
  email?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UserPreferenceSchema =
  SchemaFactory.createForClass(UserPreference);
