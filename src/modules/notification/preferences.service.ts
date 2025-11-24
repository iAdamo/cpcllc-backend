import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserPreference } from './schemas/user-preference.schema';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import {
  UserPreferenceConfig,
  NotificationChannel,
  NotificationCategory,
} from './interfaces/notification.interface';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    @InjectModel(UserPreference.name)
    private readonly userPreferenceModel: Model<UserPreference>,
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreferenceConfig> {
    const preferences = await this.userPreferenceModel.findOne({ userId });

    if (!preferences) {
      // Return default preferences if none exist
      return this.createDefaultPreferences(userId);
    }

    return this.mapToUserPreferenceConfig(preferences);
  }

  async updateUserPreferences(
    userId: string,
    updateDto: UpdatePreferencesDto,
  ): Promise<UserPreferenceConfig> {
    const preferences = await this.userPreferenceModel.findOneAndUpdate(
      { userId },
      {
        $set: updateDto,
        $setOnInsert: { userId },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );

    this.logger.log(`Preferences updated for user ${userId}`);
    return this.mapToUserPreferenceConfig(preferences);
  }

  async createDefaultPreferences(
    userId: string,
  ): Promise<UserPreferenceConfig> {
    const defaultPreferences = await this.userPreferenceModel.create({
      userId,
      enabledChannels: Object.values(NotificationChannel),
      mutedCategories: [],
      quietHours: {
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
      pushTokens: [],
    });

    return this.mapToUserPreferenceConfig(defaultPreferences);
  }

  async isCategoryMuted(
    userId: string,
    category: NotificationCategory,
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.mutedCategories.includes(category);
  }

  async isChannelEnabled(
    userId: string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.enabledChannels.includes(channel);
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);

    if (!preferences.quietHours) {
      return false;
    }

    const { start, end, timezone = 'UTC' } = preferences.quietHours;
    const now = new Date();
    const currentTime = now.toLocaleString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });

    // Handle overnight quiet hours
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }

    return currentTime >= start && currentTime <= end;
  }

  private mapToUserPreferenceConfig(
    preferences: UserPreference,
  ): UserPreferenceConfig {
    return {
      userId: preferences.userId.toString(),
      enabledChannels: preferences.enabledChannels,
      mutedCategories: preferences.mutedCategories,
      quietHours: preferences.quietHours,
      pushTokens: preferences.pushTokens,
      email: preferences.email,
      phone: preferences.phone,
    };
  }
}
