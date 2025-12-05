import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NotificationChannel,
  NotificationCategory,
} from '../interfaces/notification.interface';
import {
  UserPreference,
  UpdatePreferenceDto,
  UpdatePushTokenDto,
  NotificationPreferenceCheck,
} from '../interfaces/preference.interface';
import { UserPreference as UserPreferenceDocument } from '../schemas/user-preference.schema';

@Injectable()
export class PreferenceService {
  private readonly logger = new Logger(PreferenceService.name);

  constructor(
    @InjectModel(UserPreferenceDocument.name)
    private readonly preferenceModel: Model<UserPreferenceDocument>,
  ) {}

  async getOrCreate(userId: string): Promise<UserPreference> {
    let preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      preference = await this.createDefault(userId) as any;
    }

    return this.toResponse(preference);
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
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true },
    );

    this.logger.log(`Updated preferences for user: ${userId}`);
    return this.toResponse(preference);
  }

  async updatePushToken(
    userId: string,
    dto: UpdatePushTokenDto,
  ): Promise<void> {
    const preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      throw new NotFoundException(`Preferences not found for user: ${userId}`);
    }

    const tokenIndex = preference.pushTokens.findIndex(
      (token) => token.token === dto.token || token.deviceId === dto.deviceId,
    );

    const tokenData = {
      token: dto.token,
      platform: dto.platform,
      deviceId: dto.deviceId,
      enabled: dto.enabled ?? true,
      createdAt: new Date(),
    };

    if (tokenIndex >= 0) {
      preference.pushTokens[tokenIndex] = tokenData;
    } else {
      preference.pushTokens.push(tokenData);
    }

    preference['updatedAt'] = new Date();
    await preference.save();

    this.logger.log(
      `Updated push token for user: ${userId}, device: ${dto.deviceId}`,
    );
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    await this.preferenceModel.updateOne(
      { userId },
      {
        $pull: { pushTokens: { token } },
        $set: { updatedAt: new Date() },
      },
    );

    this.logger.log(`Removed push token for user: ${userId}`);
  }

  async canSendNotification(
    userId: string,
    category: NotificationCategory,
  ): Promise<NotificationPreferenceCheck> {
    const preference = await this.getOrCreate(userId);

    const isCategoryMuted = preference.mutedCategories.includes(category);
    if (isCategoryMuted) {
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

  async getActivePushTokens(userId: string): Promise<string[]> {
    const preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      return [];
    }

    return preference.pushTokens
      .filter((token) => token.enabled)
      .map((token) => token.token);
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await preference.save();
    return preference;
  }

  private isQuietHours(preference: UserPreference): boolean {
    if (!preference.quietHours?.enabled) {
      return false;
    }

    const { start, end, timezone } = preference.quietHours;
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

  private toResponse(preference: UserPreferenceDocument): UserPreference {
    return {
      userId: preference.userId.toString(),
      enabledChannels: preference.enabledChannels as NotificationChannel[],
      mutedCategories: preference.mutedCategories as NotificationCategory[],
      quietHours: preference.quietHours,
      pushTokens: preference.pushTokens.map((token) => ({
        token: token.token,
        platform: token.platform as 'IOS' | 'ANDROID' | 'WEB',
        deviceId: token.deviceId,
        enabled: token.enabled,
        createdAt: token.createdAt,
      })),
      email: preference.email,
      phone: preference.phone,
      language: preference.language,
      deviceInfo: preference.deviceInfo,
      createdAt: preference['createdAt'],
      updatedAt: preference['updatedAt'],
    };
  }
}
