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
      start: { type: String, default: '22:00' },
      end: { type: String, default: '08:00' },
      timezone: { type: String, default: 'UTC' },
      enabled: { type: Boolean, default: false },
    },
    required: false,
  })
  quietHours?: {
    start: string;
    end: string;
    timezone: string;
    enabled: boolean;
  };

  @Prop({
    type: [
      {
        token: { type: String, required: true },
        platform: {
          type: String,
          enum: ['IOS', 'ANDROID', 'WEB'],
          required: true,
        },
        activeUserId: { type: String, default: null },
        deviceId: { type: String, required: true },
        enabled: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  pushTokens: Array<{
    token: string;
    platform: string;
    activeUserId: string;
    deviceId: string;
    enabled: boolean;
    createdAt: Date;
  }>;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ default: 'en' })
  language: string;

  @Prop({ type: Object })
  deviceInfo?: {
    platform: string;
    osVersion: string;
    appVersion: string;
    deviceModel: string;
    locale: string;
    timezone: string;
  };
}

export const UserPreferenceSchema =
  SchemaFactory.createForClass(UserPreference);

// Indexes
UserPreferenceSchema.index({ email: 1 }, { sparse: true });
UserPreferenceSchema.index({ phone: 1 }, { sparse: true });
UserPreferenceSchema.index({ 'pushTokens.token': 1 }, { sparse: true });
