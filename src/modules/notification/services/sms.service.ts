import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SNSClient,
  PublishCommand,
  PublishCommandInput,
} from '@aws-sdk/client-sns';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
// import { defaultProvider } from '@aws-sdk/credential-providers';
// import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import Twilio from 'twilio';

export interface SMSOptions {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string;
  statusCallback?: string;
  metadata?: Record<string, string>;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  cost?: number;
}

export interface SMSProviderConfig {
  name: 'aws' | 'twilio' | 'vonage';
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
}

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);

  // AWS v3 SNS Client
  private snsClient: SNSClient | null = null;

  // Other providers
  private twilioClient: any = null;
  private vonageClient: any = null;

  private readonly providers: SMSProviderConfig[] = [];

  async onModuleInit() {
    await this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    // Initialize AWS SNS v3
    if (process.env.AWS_REGION) {
      try {
        // Using credential chain (IAM roles, environment variables, ~/.aws/credentials)
        // const credentials = fromNodeProviderChain({
        //   clientConfig: { region: process.env.AWS_REGION },
        const credentials = defaultProvider(); // Uses the default chain: env, shared config, SSO, EC2/ECS metadata, etc.

        this.snsClient = new SNSClient({
          region: process.env.AWS_REGION,
          credentials,
          maxAttempts: 3,
        });

        this.providers.push({
          name: 'aws',
          enabled: true,
          priority: 1,
          config: { region: process.env.AWS_REGION },
        });

        this.logger.log('AWS SNS v3 initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize AWS SNS v3:', error);
      }
    }

    // Initialize Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        this.twilioClient = Twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        );

        this.providers.push({
          name: 'twilio',
          enabled: true,
          priority: 2,
          config: {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            fromNumber: process.env.TWILIO_PHONE_NUMBER,
          },
        });

        this.logger.log('Twilio SMS provider initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Twilio:', error);
      }
    }

    // Initialize Vonage
    if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
      try {
        const auth = new Auth({
          apiKey: process.env.VONAGE_API_KEY,
          apiSecret: process.env.VONAGE_API_SECRET,
        });

        this.vonageClient = new Vonage(auth);

        this.providers.push({
          name: 'vonage',
          enabled: true,
          priority: 3,
          config: {
            apiKey: process.env.VONAGE_API_KEY,
            fromNumber: process.env.VONAGE_FROM_NUMBER,
          },
        });

        this.logger.log('Vonage SMS provider initialized');
      } catch (error) {
        this.logger.error('Failed to initialize Vonage:', error);
      }
    }

    this.logger.log(
      `Active SMS providers: ${this.getActiveProviders()
        .map((p) => p.name)
        .join(', ')}`,
    );
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    // Validate phone number
    const validation = this.validatePhoneNumber(options.to);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid phone number: ${validation.error}`,
        provider: 'none',
      };
    }

    // Validate message length
    if (options.body.length > 1600) {
      return {
        success: false,
        error: 'Message exceeds maximum length of 1600 characters',
        provider: 'none',
      };
    }

    // Get active providers sorted by priority
    const activeProviders = this.getActiveProviders();

    if (activeProviders.length === 0) {
      return {
        success: false,
        error: 'No SMS providers available',
        provider: 'none',
      };
    }

    // Try providers in order
    for (const provider of activeProviders) {
      try {
        let result: SMSResult;

        switch (provider.name) {
          case 'aws':
            result = await this.sendViaAws(options);
            break;

          case 'twilio':
            result = await this.sendViaTwilio(options);
            break;

          case 'vonage':
            result = await this.sendViaVonage(options);
            break;

          default:
            continue;
        }

        if (result.success) {
          this.logger.log(
            `SMS sent successfully via ${provider.name} to ${options.to}`,
          );
          return result;
        }

        this.logger.warn(`SMS failed via ${provider.name}: ${result.error}`);
      } catch (error) {
        this.logger.error(`Error with ${provider.name} provider:`, error);
      }
    }

    return {
      success: false,
      error: 'All SMS providers failed',
      provider: 'none',
    };
  }

  private async sendViaAws(options: SMSOptions): Promise<SMSResult> {
    if (!this.snsClient) {
      throw new Error('AWS SNS client not initialized');
    }

    try {
      const params: PublishCommandInput = {
        PhoneNumber: options.to,
        Message: options.body,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue:
              options.from || process.env.AWS_SNS_SENDER_ID || 'NOTIFY',
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional', // or 'Promotional'
          },
          'AWS.SNS.SMS.MaxPrice': {
            DataType: 'Number',
            StringValue: '0.50',
          },
        },
        MessageDeduplicationId: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      const command = new PublishCommand(params);
      const response = await this.snsClient.send(command);

      return {
        success: true,
        messageId: response.MessageId,
        provider: 'aws',
      };
    } catch (error: any) {
      this.logger.error('AWS SNS send failed:', error);

      return {
        success: false,
        error: error.message,
        provider: 'aws',
      };
    }
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
        provider: 'twilio',
        cost: parseFloat(message.price || '0'),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        provider: 'twilio',
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
      });

      if (result.messages[0].status === '0') {
        return {
          success: true,
          messageId: result.messages[0]['message-id'],
          provider: 'vonage',
        };
      } else {
        return {
          success: false,
          error: result.messages[0]['error-text'],
          provider: 'vonage',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        provider: 'vonage',
      };
    }
  }

  async sendBulk(
    messages: SMSOptions[],
    concurrency: number = 5,
  ): Promise<{
    sent: number;
    failed: number;
    results: SMSResult[];
  }> {
    const results: SMSResult[] = [];

    // Process in batches to respect rate limits
    for (let i = 0; i < messages.length; i += concurrency) {
      const batch = messages.slice(i, i + concurrency);
      const batchPromises = batch.map((msg) => this.send(msg));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const smsResult =
          result.status === 'fulfilled'
            ? result.value
            : {
                success: false,
                error: result.reason?.message || 'Unknown error',
                provider: 'none',
              };

        results.push(smsResult);
      });

      // Respect rate limits (AWS has ~50-100 TPS)
      if (i + concurrency < messages.length) {
        await this.delay(200);
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;

    this.logger.log(`Bulk SMS completed: ${sent} sent, ${failed} failed`);

    return { sent, failed, results };
  }

  private getActiveProviders(): SMSProviderConfig[] {
    return this.providers
      .filter((provider) => provider.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  private validatePhoneNumber(phone: string): {
    valid: boolean;
    error?: string;
    formatted?: string;
  } {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Basic validation
    if (!cleaned.match(/^\+?[1-9]\d{1,14}$/)) {
      return {
        valid: false,
        error: 'Invalid phone number format',
      };
    }

    // Ensure E.164 format
    let formatted = cleaned;
    if (!formatted.startsWith('+')) {
      // Add default country code if not present
      const defaultCountryCode = process.env.DEFAULT_SMS_COUNTRY_CODE || '1';
      formatted = `+${defaultCountryCode}${formatted}`;
    }

    return {
      valid: true,
      formatted,
    };
  }

  getProviderStatus(): Record<string, any> {
    return this.providers.reduce((acc, provider) => {
      acc[provider.name] = {
        enabled: provider.enabled,
        priority: provider.priority,
      };
      return acc;
    }, {});
  }

  async getAwsSnsStats(): Promise<any> {
    if (!this.snsClient) {
      return { error: 'AWS SNS not initialized' };
    }

    // Note: AWS SNS doesn't have a direct stats API
    // You would need CloudWatch for metrics
    return {
      provider: 'aws',
      region: process.env.AWS_REGION,
      timestamp: new Date().toISOString(),
    };
  }

  enableProvider(name: string): void {
    const provider = this.providers.find((p) => p.name === name);
    if (provider) {
      provider.enabled = true;
      this.logger.log(`Enabled SMS provider: ${name}`);
    }
  }

  disableProvider(name: string): void {
    const provider = this.providers.find((p) => p.name === name);
    if (provider) {
      provider.enabled = false;
      this.logger.log(`Disabled SMS provider: ${name}`);
    }
  }

  setProviderPriority(name: string, priority: number): void {
    const provider = this.providers.find((p) => p.name === name);
    if (provider) {
      provider.priority = priority;
      this.logger.log(`Set ${name} provider priority to ${priority}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
