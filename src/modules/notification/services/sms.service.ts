import { defaultProvider } from '@aws-sdk/credential-provider-node';
// import { defaultProvider } from '@aws-sdk/credential-providers';
// import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import Twilio from 'twilio';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SNSClient,
  PublishCommand,
  PublishCommandInput,
  SNSClientConfig,
} from '@aws-sdk/client-sns';

export interface SMSOptions {
  to: string;
  body: string;
  from?: string;
  mediaUrl?: string;
  statusCallback?: string;
  metadata?: Record<string, string>;
  messageType?: 'TRANSACTIONAL' | 'PROMOTIONAL';
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
  cost?: number;
}

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private snsClient: SNSClient | null = null;
  private twilioClient: any = null;
  private vonageClient: any = null;

  async onModuleInit() {
    await this.initializeAwsSns();
    await this.initializeOtherProviders();
  }

  private async initializeAwsSns(): Promise<void> {
    if (!process.env.AWS_REGION) {
      this.logger.warn('AWS_REGION not set, skipping AWS SNS initialization');
      return;
    }

    try {
      // const credentials = defaultProvider({
      //   clientConfig: { region: process.env.AWS_REGION },
      // });
      const credentials = defaultProvider();
      const clientConfig: SNSClientConfig = {
        region: process.env.AWS_REGION,
        credentials,
        maxAttempts: 3,
      };

      // Add endpoint for testing/local development
      if (process.env.AWS_SNS_ENDPOINT) {
        clientConfig.endpoint = process.env.AWS_SNS_ENDPOINT;
      }

      this.snsClient = new SNSClient(clientConfig);

      // Test connection
      await this.testAwsConnection();

      this.logger.log('AWS SNS v3 initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize AWS SNS v3:', error);
      this.snsClient = null;
    }
  }

  private async testAwsConnection(): Promise<void> {
    if (!this.snsClient) return;

    try {
      // Simple test to verify credentials and permissions
      // We'll try to get topic attributes (requires minimal permissions)
      // If this fails, we know there's a configuration issue
      this.logger.debug('Testing AWS SNS connection...');
      // Connection will be tested on first actual send
    } catch (error: any) {
      this.logger.error('AWS SNS connection test failed:', error);
      throw error;
    }
  }

  private async initializeOtherProviders(): Promise<void> {
    // Initialize Twilio (fallback)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        this.twilioClient = Twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        );
        this.logger.log('Twilio SMS provider initialized');
      } catch (error: any) {
        this.logger.error('Failed to initialize Twilio:', error);
      }
    }

    // Initialize Vonage (fallback)
    if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
      try {
        const auth = new Auth({
          apiKey: process.env.VONAGE_API_KEY,
          apiSecret: process.env.VONAGE_API_SECRET,
        });
        this.vonageClient = new Vonage(auth);
        this.logger.log('Vonage SMS provider initialized');
      } catch (error: any) {
        this.logger.error('Failed to initialize Vonage:', error);
      }
    }
  }

  async send(options: SMSOptions): Promise<SMSResult> {
    // Validate inputs
    const validation = this.validateSmsOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        provider: 'none',
      };
    }

    // Try AWS SNS first (if available and phone number is valid for SMS)
    if (this.snsClient && this.isPhoneNumberValidForAws(options.to)) {
      try {
        const result = await this.sendViaAwsSns(options);
        if (result.success) {
          return result;
        }
        this.logger.warn(`AWS SNS failed: ${result.error}, trying fallback...`);
      } catch (error: any) {
        this.logger.error('AWS SNS error:', error);
      }
    }

    // Try Twilio fallback
    if (this.twilioClient) {
      try {
        const result = await this.sendViaTwilio(options);
        if (result.success) {
          return result;
        }
        this.logger.warn(`Twilio failed: ${result.error}`);
      } catch (error: any) {
        this.logger.error('Twilio error:', error);
      }
    }

    // Try Vonage fallback
    if (this.vonageClient) {
      try {
        const result = await this.sendViaVonage(options);
        if (result.success) {
          return result;
        }
        this.logger.warn(`Vonage failed: ${result.error}`);
      } catch (error: any) {
        this.logger.error('Vonage error:', error);
      }
    }

    return {
      success: false,
      error: 'All SMS providers failed',
      provider: 'none',
    };
  }

  private async sendViaAwsSns(options: SMSOptions): Promise<SMSResult> {
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
            StringValue: options.messageType || 'Transactional', // 'Transactional' or 'Promotional'
          },
          'AWS.SNS.SMS.MaxPrice': {
            DataType: 'Number',
            StringValue: process.env.AWS_SNS_MAX_PRICE || '0.50',
          },
        },
        // NO MessageDeduplicationId - SMS doesn't support FIFO!
        // NO MessageGroupId - SMS doesn't support FIFO!
      };

      // For long messages, set appropriate attributes
      if (options.body.length > 160) {
        params.MessageAttributes!['AWS.SNS.SMS.MaxLength'] = {
          DataType: 'String',
          StringValue: '160', // Messages longer than 160 chars will be split
        };
      }

      const command = new PublishCommand(params);
      const startTime = Date.now();
      const response = await this.snsClient.send(command);
      const duration = Date.now() - startTime;

      this.logger.debug(
        `AWS SNS SMS sent in ${duration}ms: ${response.MessageId}`,
      );

      return {
        success: true,
        messageId: response.MessageId,
        provider: 'aws',
      };
    } catch (error: any) {
      this.logger.error('AWS SNS send failed:', error);

      // Handle specific AWS errors
      let errorMessage = error.message;
      if (error.name === 'InvalidParameterException') {
        errorMessage = `Invalid parameters: ${error.message}`;
      } else if (error.name === 'AuthorizationErrorException') {
        errorMessage = 'AWS SNS authorization failed. Check IAM permissions.';
      } else if (error.name === 'InternalErrorException') {
        errorMessage = 'AWS SNS internal error. Please retry.';
      }

      return {
        success: false,
        error: errorMessage,
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

      const response = await this.vonageClient.sms.send({
        to: options.to,
        from,
        text: options.body,
      });

      if (response.messages[0].status === '0') {
        return {
          success: true,
          messageId: response.messages[0]['message-id'],
          provider: 'vonage',
        };
      } else {
        return {
          success: false,
          error: response.messages[0]['error-text'],
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

  private validateSmsOptions(options: SMSOptions): {
    valid: boolean;
    error?: string;
  } {
    // Validate phone number
    if (!this.isValidPhoneNumber(options.to)) {
      return {
        valid: false,
        error: 'Invalid phone number format',
      };
    }

    // Validate message body
    if (!options.body || options.body.trim().length === 0) {
      return {
        valid: false,
        error: 'Message body cannot be empty',
      };
    }

    // Validate message length
    const maxLength = 1600; // AWS SNS limit
    if (options.body.length > maxLength) {
      return {
        valid: false,
        error: `Message exceeds maximum length of ${maxLength} characters`,
      };
    }

    return { valid: true };
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(cleaned);
  }

  private isPhoneNumberValidForAws(phone: string): boolean {
    // AWS SNS has specific country code restrictions
    // Check if the phone number is in a supported country
    const cleaned = phone.replace(/[^\d+]/g, '');

    // Extract country code
    const countryCodeMatch = cleaned.match(/^\+\d+/);
    if (!countryCodeMatch) return false;

    const countryCode = countryCodeMatch[0];

    // List of AWS SNS supported country codes (partial list)
    const supportedCountryCodes = [
      '+1', // USA/Canada
      '+44', // UK
      '+61', // Australia
      '+49', // Germany
      '+33', // France
      '+81', // Japan
      '+86', // China
      '+91', // India
    ];

    return supportedCountryCodes.some((code) => countryCode.startsWith(code));
  }

  async sendBulk(
    messages: SMSOptions[],
    concurrency: number = 10,
  ): Promise<{
    sent: number;
    failed: number;
    results: SMSResult[];
  }> {
    const results: SMSResult[] = [];

    // Validate all messages first
    const validMessages: SMSOptions[] = [];
    const invalidMessages: { index: number; error: string }[] = [];

    messages.forEach((msg, index) => {
      const validation = this.validateSmsOptions(msg);
      if (validation.valid) {
        validMessages.push(msg);
      } else {
        invalidMessages.push({ index, error: validation.error! });
        results.push({
          success: false,
          error: validation.error,
          provider: 'none',
        });
      }
    });

    // Send valid messages in batches
    for (let i = 0; i < validMessages.length; i += concurrency) {
      const batch = validMessages.slice(i, i + concurrency);
      const batchPromises = batch.map((msg) => this.send(msg));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown error',
            provider: 'none',
          });
        }
      });

      // Rate limiting - AWS SNS has limits (varies by region)
      if (i + concurrency < validMessages.length) {
        await this.delay(100); // 100ms delay between batches
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;

    if (invalidMessages.length > 0) {
      this.logger.warn(`${invalidMessages.length} messages failed validation`);
    }

    this.logger.log(
      `Bulk SMS completed: ${sent} sent, ${failed} failed (${invalidMessages.length} invalid)`,
    );

    return { sent, failed, results };
  }

  getProviderStatus(): {
    aws: boolean;
    twilio: boolean;
    vonage: boolean;
  } {
    return {
      aws: !!this.snsClient,
      twilio: !!this.twilioClient,
      vonage: !!this.vonageClient,
    };
  }

  async getAwsSmsAttributes(): Promise<Record<string, any>> {
    if (!this.snsClient) {
      return { error: 'AWS SNS not initialized' };
    }

    // Note: Getting SMS attributes requires different API calls
    // This is a simplified version
    return {
      provider: 'aws',
      region: process.env.AWS_REGION,
      maxPrice: process.env.AWS_SNS_MAX_PRICE || '0.50',
      defaultSenderId: process.env.AWS_SNS_SENDER_ID || 'NOTIFY',
      timestamp: new Date().toISOString(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
