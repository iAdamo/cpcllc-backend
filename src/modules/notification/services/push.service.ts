import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import * as webpush from 'web-push';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserPreference as UserPreferenceDocument } from '@notification/schemas/user-preference.schema';

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

export interface PushTokenInfo {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  deviceId: string;
  enabled: boolean;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private firebaseApp: admin.app.App | null = null;
  private expo: Expo | null = null;
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;

  constructor(
    @InjectModel(UserPreferenceDocument.name)
    private readonly preferenceModel: Model<UserPreferenceDocument>,
  ) {
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize Firebase Admin
    if (process.env.FIREBASE_PROJECT_ID) {
      try {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
        this.logger.log('Firebase Admin initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Firebase Admin:', error);
      }
    }

    // Initialize Expo
    if (process.env.EXPO_ACCESS_TOKEN) {
      this.expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
      this.logger.log('Expo SDK initialized');
    }

    // Initialize Web Push (VAPID)
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

  async send(message: PushMessage): Promise<PushResult> {
    const tokens = Array.isArray(message.to) ? message.to : [message.to];
    const results: PushResult[] = [];

    for (const token of tokens) {
      try {
        const platform = this.detectPlatform(token);
        let result: PushResult;

        switch (platform) {
          case 'IOS':
          case 'ANDROID':
            result = await this.sendToFirebase(token, message, platform);
            break;

          case 'WEB':
            result = await this.sendToExpo(token, message);
            break;

          default:
            result = {
              success: false,
              error: `Unsupported platform for token: ${token}`,
              platform,
            };
        }

        results.push(result);

        if (!result.success) {
          this.logger.warn(`Failed to send push to ${token}: ${result.error}`);
        }
      } catch (error: any) {
        this.logger.error(`Error sending push to ${token}:`, error);
        results.push({
          success: false,
          error: error.message,
        });
      }
    }

    // Return overall result
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return {
      success: successCount > 0,
      messageId: `batch_${Date.now()}`,
      ...(failedCount > 0 && { error: `${failedCount} tokens failed` }),
    };
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<PushResult> {
    const tokens = await this.getUserPushTokens(userId);

    if (tokens.length === 0) {
      return {
        success: false,
        error: 'No push tokens available for user',
      };
    }

    const message: PushMessage = {
      to: tokens,
      title,
      body,
      data,
      priority: 'high',
    };

    return this.send(message);
  }

  async sendBulk(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        const result = await this.sendToUser(userId, title, body, data);

        if (result.success) {
          sent++;
        } else {
          failed++;
          this.logger.warn(`Failed to send to user ${userId}: ${result.error}`);
        }
      } catch (error) {
        failed++;
        this.logger.error(`Error sending to user ${userId}:`, error);
      }
    }

    this.logger.log(`Bulk push completed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      if (this.isFirebaseToken(token)) {
        return await this.validateFirebaseToken(token);
      }

      if (this.isExpoToken(token)) {
        return await this.validateExpoToken(token);
      }

      if (this.isWebPushToken(token)) {
        return true; // Web push tokens are always valid until they fail
      }

      return false;
    } catch (error) {
      this.logger.debug(`Token validation failed for ${token}:`, error);
      return false;
    }
  }

  private async sendToFirebase(
    token: string,
    message: PushMessage,
    platform: 'IOS' | 'ANDROID',
  ): Promise<PushResult> {
    if (!this.firebaseApp) {
      throw new Error('Firebase Admin not initialized');
    }

    const messaging = this.firebaseApp.messaging();

    const payload: admin.messaging.Message = {
      token,
      notification: {
        title: message.title,
        body: message.body,
        imageUrl: message.image,
      },
      data: message.data,
      android: {
        priority: message.priority === 'high' ? 'high' : 'normal',
        ttl: message.ttl ? message.ttl * 1000 : 3600000, // 1 hour default
        notification: {
          icon: message.icon,
          color: '#007bff',
          sound: message.sound || 'default',
          channelId: message.channelId || 'default',
          ...(message.badge && { notificationCount: message.badge }),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: message.title,
              body: message.body,
            },
            sound: message.sound || 'default',
            badge: message.badge,
            'mutable-content': 1,
          },
        },
        headers: {
          'apns-priority': message.priority === 'high' ? '10' : '5',
          'apns-expiration': message.ttl
            ? (Math.floor(Date.now() / 1000) + message.ttl).toString()
            : undefined,
        },
      },
      webpush: {
        headers: {
          Urgency: message.priority === 'high' ? 'high' : 'normal',
          TTL: message.ttl?.toString() || '3600',
        },
        notification: {
          icon: message.icon,
          badge: message.badge?.toString(),
          vibrate: [100, 50, 100],
          requireInteraction: message.priority === 'high',
        },
      },
    };

    try {
      const messageId = await messaging.send(payload);

      return {
        success: true,
        messageId,
        platform,
      };
    } catch (error: any) {
      // Check if token is invalid and should be removed
      if (this.isInvalidTokenError(error)) {
        await this.markTokenAsInvalid(token);
      }

      return {
        success: false,
        error: error.message,
        platform,
      };
    }
  }

  private async sendToExpo(
    token: string,
    message: PushMessage,
  ): Promise<PushResult> {
    if (!this.expo) {
      throw new Error('Expo SDK not initialized');
    }

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

      if (ticket.status === 'ok') {
        return {
          success: true,
          messageId: ticket.id,
          platform: 'WEB',
        };
      } else {
        return {
          success: false,
          error: ticket.message || 'Unknown Expo error',
          platform: 'WEB',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        platform: 'WEB',
      };
    }
  }

  private async sendToWebPush(
    subscription: webpush.PushSubscription,
    message: PushMessage,
  ): Promise<PushResult> {
    if (!this.vapidKeys) {
      throw new Error('Web Push VAPID not initialized');
    }

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
      await webpush.sendNotification(subscription, payload, {
        TTL: message.ttl || 3600,
        urgency: message.priority === 'high' ? 'high' : 'normal',
      });

      return {
        success: true,
        platform: 'WEB',
      };
    } catch (error: any) {
      // Check if subscription is expired
      if (error.statusCode === 410) {
        await this.markTokenAsInvalid(subscription.endpoint);
      }

      return {
        success: false,
        error: error.message,
        platform: 'WEB',
      };
    }
  }

  private async getUserPushTokens(userId: string): Promise<string[]> {
    const preference = await this.preferenceModel.findOne({ userId });

    if (!preference) {
      return [];
    }

    return preference.pushTokens
      .filter((token) => token.enabled)
      .map((token) => token.token);
  }

  private detectPlatform(token: string): 'IOS' | 'ANDROID' | 'WEB' {
    if (this.isFirebaseToken(token)) {
      // Firebase tokens could be iOS or Android
      return token.length > 100 ? 'IOS' : 'ANDROID';
    }

    if (this.isExpoToken(token)) {
      return 'WEB';
    }

    if (this.isWebPushToken(token)) {
      return 'WEB';
    }

    return 'WEB'; // Default
  }

  private isFirebaseToken(token: string): boolean {
    return (
      token.startsWith('c') || token.startsWith('f') || token.length === 152
    );
  }

  private isExpoToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  private isWebPushToken(token: string): boolean {
    return token.startsWith('https://') || token.includes('web.push');
  }

  private isInvalidTokenError(error: any): boolean {
    const errorCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
    ];

    return (
      errorCodes.includes(error.code) ||
      error.message?.includes('Invalid registration token') ||
      error.message?.includes('NotRegistered')
    );
  }

  private async validateFirebaseToken(token: string): Promise<boolean> {
    if (!this.firebaseApp) return false;

    try {
      const messaging = this.firebaseApp.messaging();
      await messaging.send(
        { token, notification: { title: 'Test', body: 'Test' } },
        true,
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  private async validateExpoToken(token: string): Promise<boolean> {
    if (!this.expo) return false;

    try {
      return Expo.isExpoPushToken(token);
    } catch (error) {
      return false;
    }
  }

  private async markTokenAsInvalid(token: string): Promise<void> {
    await this.preferenceModel.updateOne(
      { 'pushTokens.token': token },
      { $set: { 'pushTokens.$.enabled': false } },
    );

    this.logger.log(`Disabled invalid push token: ${token}`);
  }

  getServiceStatus(): Record<string, boolean> {
    return {
      firebase: !!this.firebaseApp,
      expo: !!this.expo,
      webpush: !!this.vapidKeys,
    };
  }
}
