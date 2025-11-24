import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseAdapter,
  NotificationAdapter,
} from '../interfaces/adapter.interface';
import { NotificationPayload } from '../interfaces/notification.interface';

@Injectable()
export class EmailAdapter extends BaseAdapter implements NotificationAdapter {
  readonly channel = 'email';
  private readonly logger = new Logger(EmailAdapter.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async send(payload: NotificationPayload, options?: any): Promise<void> {
    this.validatePayload(payload);

    // In production, integrate with SendGrid, AWS SES, etc.
    const emailConfig = {
      from: this.configService.get('EMAIL_FROM'),
      to: options?.email || payload.meta?.email,
      subject: payload.title,
      html: this.buildEmailTemplate(payload),
      // ... other email options
    };

    this.logger.log(
      `Sending email to user ${payload.userId}: ${payload.title}`,
    );

    // Stub implementation - replace with actual email service
    this.logger.debug('Email payload:', emailConfig);

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.log(`Email sent successfully to user ${payload.userId}`);
  }

  private buildEmailTemplate(payload: NotificationPayload): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { padding: 20px; text-align: center; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${payload.title}</h1>
            </div>
            <div class="content">
              <p>${payload.body}</p>
              ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="color: #007bff;">Take Action</a>` : ''}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Your Company</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
