import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationChannel,
  NotificationCategory,
} from '../interfaces/notification.interface';
import {
  UpdatePreferenceDto,
  UpdatePushTokenDto,
  NotificationPreferenceCheck,
} from '../interfaces/preference.interface';
import {
  UserPreferenceDocument,
  UserPreference,
} from '../schemas/user-preference.schema';
import { AuthUser } from '@websocket/interfaces/websocket.interface';

@Injectable()
export class PreferenceService {
  private readonly logger = new Logger(PreferenceService.name);

  constructor(
    @InjectModel(UserPreference.name)
    private readonly preferenceModel: Model<UserPreferenceDocument>,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                               CORE HELPERS                                  */
  /* -------------------------------------------------------------------------- */

  async getOrCreate(userId: string): Promise<UserPreferenceDocument> {
    let preference: any;
    preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      preference = await this.createDefault(userId);
    }

    return preference;
  }

  private async createDefault(userId: string): Promise<UserPreferenceDocument> {
    const preference = new this.preferenceModel({
      userId,
      enabledChannels: Object.values(NotificationChannel),
      mutedCategories: [],
      quietHours: {
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
        enabled: false,
      },
      pushTokens: [],
      language: 'en',
    });

    await preference.save();
    return preference;
  }

  async update(
    userId: string,
    dto: UpdatePreferenceDto,
  ): Promise<UserPreference> {
    const preference = await this.preferenceModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          ...dto,
        },
      },
      { new: true, upsert: true },
    );

    this.logger.log(`Updated preferences for user: ${userId}`);
    return preference;
  }

  /**
   * Called on LOGIN / APP START
   * Guarantees: one device → one active user
   */
  async updatePushToken(
    user: AuthUser['user'],
    dto: UpdatePushTokenDto,
  ): Promise<void> {
    const { userId, deviceId } = user;

    await this.disableDeviceTokensForOtherUsers(deviceId, userId);

    const preference = await this.getOrCreate(userId);

    if (!Array.isArray(preference.pushTokens)) {
      preference.pushTokens = [];
    }

    const index = preference.pushTokens.findIndex(
      (t) => t.deviceId === deviceId,
    );

    const tokenData = {
      token: dto.token,
      platform: dto.platform,
      deviceId,
      enabled: true,
      createdAt: new Date(),
    };

    if (index >= 0) {
      preference.pushTokens[index] = tokenData;
    } else {
      preference.pushTokens.push(tokenData);
    }

    await preference.save();

    this.logger.log(
      `Push token registered | user=${userId} device=${deviceId}`,
    );
  }

  /**
   * Disable device tokens for all OTHER users
   */
  private async disableDeviceTokensForOtherUsers(
    deviceId: string,
    currentUserId: string,
  ): Promise<void> {
    await this.preferenceModel.updateMany(
      {
        userId: { $ne: currentUserId },
        'pushTokens.deviceId': deviceId,
      },
      {
        $set: {
          'pushTokens.$[token].enabled': false,
        },
      },
      {
        arrayFilters: [{ 'token.deviceId': deviceId }],
      },
    );
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    await this.preferenceModel.updateOne(
      { userId },
      { $pull: { pushTokens: { token } }, $set: { updatedAt: new Date() } },
    );
    this.logger.log(`Removed push token for user: ${userId}`);
  }

  /**
   * MUST be called on LOGOUT
   */
  async disablePushTokensForUserDevice(
    userId: string,
    deviceId: string,
  ): Promise<void> {
    await this.preferenceModel.updateOne(
      { userId, 'pushTokens.deviceId': deviceId },
      {
        $set: {
          'pushTokens.$.enabled': false,
        },
      },
    );

    this.logger.log(`Push tokens disabled | user=${userId} device=${deviceId}`);
  }

  async canSendNotification(
    userId: string,
    category: NotificationCategory,
  ): Promise<NotificationPreferenceCheck> {
    const preference = await this.getOrCreate(userId);

    if (preference.mutedCategories.includes(category)) {
      return {
        userId,
        canSend: false,
        reason: 'Category is muted',
        preferredChannels: [],
        isQuietHours: false,
        isCategoryMuted: true,
      };
    }

    const isQuietHours = this.isQuietHours(preference);
    if (isQuietHours) {
      return {
        userId,
        canSend: false,
        reason: 'Quiet hours active',
        preferredChannels: [],
        isQuietHours: true,
        isCategoryMuted: false,
      };
    }

    return {
      userId,
      canSend: true,
      preferredChannels: preference.enabledChannels,
      isQuietHours: false,
      isCategoryMuted: false,
    };
  }

  /**
   * FINAL SAFETY GATE
   */
  async getActivePushTokens(userId: string): Promise<string[]> {
    const preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      return [];
    }

    return preference.pushTokens
      .filter((t) => t.enabled === true)
      .map((t) => t.token);
  }

  private isQuietHours(preference: UserPreference): boolean {
    if (!preference.quietHours?.enabled) {
      return false;
    }

    const { start, end } = preference.quietHours;
    const now = new Date();

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);

    const startTime = new Date(now);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);

    if (startTime > endTime) {
      return now >= startTime || now <= endTime;
    }

    return now >= startTime && now <= endTime;
  }
}
