import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';
import {
  SNSClient,
  PublishCommand,
  PublishCommandInput,
} from '@aws-sdk/client-sns';
// import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';

export interface SMSOptions {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string;
  statusCallback?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface SMSProvider {
  name: string;
  enabled: boolean;
  priority: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // Providers
  private twilioClient: any = null;
  private awsSns: AWS.SNS | null = null;
  private vonageClient: any = null;

  private readonly providers: SMSProvider[] = [
    { name: 'twilio', enabled: false, priority: 1 },
    { name: 'aws', enabled: false, priority: 2 },
    { name: 'vonage', enabled: false, priority: 3 },
  ];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );
      this.setProviderEnabled('twilio', true);
      this.logger.log('Twilio SMS provider initialized');
    }

    // Initialize AWS SNS
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });

      this.awsSns = new AWS.SNS();
      this.setProviderEnabled('aws', true);
      this.logger.log('AWS SNS provider initialized');
    }

    // Initialize Vonage (Nexmo)
    if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
      const auth = new Auth({
        apiKey: process.env.VONAGE_API_KEY,
        apiSecret: process.env.VONAGE_API_SECRET,
      });

      this.vonageClient = new Vonage(auth);
      this.setProviderEnabled('vonage', true);
      this.logger.log('Vonage SMS provider initialized');
    }

    this.logger.log(
      `Active SMS providers: ${this.getActiveProviders()
        .map((p) => p.name)
        .join(', ')}`,
    );
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    // Validate phone number
    if (!this.isValidPhoneNumber(options.to)) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    // Validate message length
    if (options.body.length > 1600) {
      // SMS concatenation limit
      return {
        success: false,
        error: 'Message too long (max 1600 characters)',
      };
    }

    // Get active providers in priority order
    const activeProviders = this.getActiveProviders();

    if (activeProviders.length === 0) {
      return {
        success: false,
        error: 'No SMS providers configured',
      };
    }

    // Try providers in order until one succeeds
    for (const provider of activeProviders) {
      try {
        let result: SMSResult;

        switch (provider.name) {
          case 'twilio':
            result = await this.sendViaTwilio(options);
            break;

          case 'aws':
            result = await this.sendViaAws(options);
            break;

          case 'vonage':
            result = await this.sendViaVonage(options);
            break;

          default:
            continue;
        }

        if (result.success) {
          this.logger.log(
            `SMS sent via ${provider.name} to ${options.to}: ${result.messageId}`,
          );
          return { ...result, provider: provider.name };
        }

        this.logger.warn(
          `SMS failed via ${provider.name} to ${options.to}: ${result.error}`,
        );
      } catch (error) {
        this.logger.error(`Error sending SMS via ${provider.name}:`, error);
      }
    }

    return {
      success: false,
      error: 'All SMS providers failed',
      provider: 'none',
    };
  }

  async sendBulk(
    messages: SMSOptions[],
    concurrency: number = 10,
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process in batches
    for (let i = 0; i < messages.length; i += concurrency) {
      const batch = messages.slice(i, i + concurrency);
      const batchPromises = batch.map((message) => this.send(message));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const message = batch[index];

        if (result.status === 'fulfilled' && result.value.success) {
          results.sent++;
        } else {
          results.failed++;
          const error =
            result.status === 'rejected'
              ? result.reason.message
              : result.value.error;
          results.errors.push(`Failed to send to ${message.to}: ${error}`);
        }
      });

      // Rate limiting delay
      if (i + concurrency < messages.length) {
        await this.delay(1000);
      }
    }

    this.logger.log(
      `Bulk SMS completed: ${results.sent} sent, ${results.failed} failed`,
    );
    return results;
  }

  private async sendViaTwilio(options: SMSOptions): Promise<SMSResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: options.body,
        to: options.to,
        from: options.from || process.env.TWILIO_PHONE_NUMBER,
        mediaUrl: options.mediaUrl ? [options.mediaUrl] : undefined,
        statusCallback: options.statusCallback,
      });

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async sendViaAws(options: SMSOptions): Promise<SMSResult> {
    if (!this.awsSns) {
      throw new Error('AWS SNS not initialized');
    }

    try {
      const params: AWS.SNS.PublishInput = {
        Message: options.body,
        PhoneNumber: options.to,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue:
              options.from || process.env.AWS_SNS_SENDER_ID || 'NOTIFY',
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
          'AWS.SNS.SMS.MaxPrice': {
            DataType: 'Number',
            StringValue: '0.50',
          },
        },
      };

      const result = await this.awsSns.publish(params).promise();

      return {
        success: true,
        messageId: result.MessageId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async sendViaVonage(options: SMSOptions): Promise<SMSResult> {
    if (!this.vonageClient) {
      throw new Error('Vonage client not initialized');
    }

    try {
      const from = options.from || process.env.VONAGE_FROM_NUMBER || 'Vonage';

      const result = await this.vonageClient.sms.send({
        to: options.to,
        from,
        text: options.body,
        ...(options.mediaUrl && { type: 'image', url: options.mediaUrl }),
      });

      if (result.messages[0].status === '0') {
        return {
          success: true,
          messageId: result.messages[0]['message-id'],
        };
      } else {
        return {
          success: false,
          error: result.messages[0]['error-text'],
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic phone validation - in production use libphonenumber-js
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  private getActiveProviders(): SMSProvider[] {
    return this.providers
      .filter((provider) => provider.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  private setProviderEnabled(name: string, enabled: boolean): void {
    const provider = this.providers.find((p) => p.name === name);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  getProviderStatus(): Record<string, boolean> {
    return this.providers.reduce((acc, provider) => {
      acc[provider.name] = provider.enabled;
      return acc;
    }, {});
  }

  async validatePhoneNumber(phone: string): Promise<{
    valid: boolean;
    formatted?: string;
    carrier?: string;
    type?: string;
  }> {
    if (!this.isValidPhoneNumber(phone)) {
      return { valid: false };
    }

    // In production, implement proper phone validation
    // This is a simplified version
    return {
      valid: true,
      formatted: phone,
    };
  }

  getUsageStats(): any {
    // In production, track SMS usage
    return {
      providers: this.getProviderStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
