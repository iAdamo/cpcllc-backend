// notification/services/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import * as webpush from 'web-push';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserPreference as UserPreferenceDocument } from '@notification/schemas/user-preference.schema';
import constants from 'constants';

export interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  image?: string;
  icon?: string;
  badge?: number;
  sound?: string;
  priority?: 'normal' | 'high';
  collapseKey?: string;
  ttl?: number;
  channelId?: string;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  platform?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private expo: Expo;
  private vapidKeys: { publicKey: string; privateKey: string };

  constructor(
    @InjectModel(UserPreferenceDocument.name)
    private readonly preferenceModel: Model<UserPreferenceDocument>,
  ) {
    this.initializeServices();
  }

  private initializeServices() {
    // Initialize Expo
    // if (!process.env.EXPO_ACCESS_TOKEN) {
    //   throw new Error('EXPO_ACCESS_TOKEN is required for push notifications');
    // }
    if (process.env.EXPO_ACCESS_TOKEN) {
      this.expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
      this.logger.log('Expo SDK initialized');
    }
    // Initialize Web Push (VAPID)
    // if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    //   throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required');
    // }
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.vapidKeys = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
      };

      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:notifications@example.com',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey,
      );

      this.logger.log('Web Push VAPID initialized');
    }
  }

  /**
   * Send push to one or more tokens
   */
  async send(message: PushMessage): Promise<PushResult> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const results: PushResult[] = [];

    for (const recipient of recipients) {
      try {
        let result: PushResult;
        const tokens = await this.getUserPushTokens(recipient);
        for (const token of tokens) {
          if (this.isExpoToken(token.token)) {
            result = await this.sendToExpo(token.token, message);
          } else if (this.isWebPushToken(token.token)) {
            result = await this.sendToWebPush(token.token, message);
          } else if (token.success) {
            result = {
              success: token.success,
            };
          } else {
            result = {
              success: false,
              error: 'Unsupported token type',
            };
          }

          results.push(result);
          if (!result.success) {
            this.logger.warn(
              `Failed to send push to ${token}: ${result.error}`,
            );
          }
        }
      } catch (error: any) {
        results.push({ success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return {
      success: successCount > 0,
      messageId: `batch_${Date.now()}`,
      ...(failedCount > 0 && { error: `${failedCount} tokens failed` }),
    };
  }

  private async sendToExpo(
    token: string,
    message: PushMessage,
  ): Promise<PushResult> {
    const expoMessage: ExpoPushMessage = {
      to: token,
      title: message.title,
      body: message.body,
      data: message.data,
      sound: message.sound || 'default',
      badge: message.badge,
      priority: message.priority === 'high' ? 'high' : 'default',
      ...(message.ttl && { ttl: message.ttl }),
      ...(message.channelId && { channelId: message.channelId }),
    };

    try {
      const tickets = await this.expo.sendPushNotificationsAsync([expoMessage]);
      const ticket = tickets[0];
      return ticket.status === 'ok'
        ? { success: true, messageId: ticket.id, platform: 'MOBILE' }
        : {
            success: false,
            error: ticket.message || 'Unknown Expo error',
            platform: 'MOBILE',
          };
    } catch (error: any) {
      return { success: false, error: error.message, platform: 'MOBILE' };
    }
  }

  private async sendToWebPush(
    token: string,
    message: PushMessage,
  ): Promise<PushResult> {
    if (!this.vapidKeys) throw new Error('Web Push VAPID not initialized');

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      icon: message.icon,
      badge: message.badge,
      image: message.image,
      data: message.data,
      timestamp: new Date().toISOString(),
    });

    try {
      await webpush.sendNotification(token as any, payload, {
        TTL: message.ttl || 3600,
        urgency: message.priority === 'high' ? 'high' : 'normal',
      });

      return { success: true, platform: 'WEB' };
    } catch (error: any) {
      return { success: false, error: error.message, platform: 'WEB' };
    }
  }

  private async getUserPushTokens(
    userId: string,
  ): Promise<{ token: string; success: boolean }[]> {
    const preference = await this.preferenceModel.findOne({ userId }).lean();

    // User has no preference record → real failure
    if (!preference) {
      return [{ token: '', success: false }];
    }

    const tokens = preference.pushTokens.filter(
      (t) => t.enabled && t.activeUserId === userId,
    );

    // No usable tokens, but still a successful notification lifecycle
    if (tokens.length === 0) {
      return [{ token: '', success: true }];
    }

    return tokens.map((t) => ({
      token: t.token,
      success: true,
    }));
  }

  private isExpoToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  private isWebPushToken(token: string): boolean {
    return token.startsWith('https://') || token.includes('web.push');
  }

  getServiceStatus() {
    return { expo: !!this.expo, webpush: !!this.vapidKeys };
  }
}
