import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { createTransport, Transporter } from 'nodemailer';
import { compile } from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
  attachments?: Mail.Attachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly templates: Map<string, HandlebarsTemplateDelegate> =
    new Map();

  constructor() {
    this.initializeTransporter();
    this.loadTemplates();
  }

  private initializeTransporter(): void {
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    };

    this.transporter = createTransport(config);

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP connection failed:', error);
      } else {
        this.logger.log('SMTP connection established successfully');
      }
    });
  }

  private loadTemplates(): void {
    try {
      const templateDir = join(__dirname, '../../../templates/emails');

      const templates = [
        'notification',
        'welcome',
        'verification',
        'password-reset',
      ];

      templates.forEach((templateName) => {
        try {
          const templatePath = join(templateDir, `${templateName}.hbs`);
          const templateContent = readFileSync(templatePath, 'utf-8');
          const compiledTemplate = compile(templateContent);
          this.templates.set(templateName, compiledTemplate);
        } catch (error) {
          this.logger.warn(`Template ${templateName} not found, using default`);
        }
      });
    } catch (error) {
      this.logger.warn('Could not load email templates:', error);
    }
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const startTime = Date.now();

    try {
      const mailOptions: Mail.Options = {
        from: this.getFromAddress(),
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: await this.getEmailContent(options),
        text: options.text,
        attachments: options.attachments,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        headers: {
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
          'X-Mailer': 'NestJS Notification System',
          'List-Unsubscribe': `<${process.env.UNSUBSCRIBE_URL}>`,
        },
      };

      const info = await this.transporter.sendMail(mailOptions);

      const duration = Date.now() - startTime;
      this.logger.log(
        `Email sent to ${options.to} in ${duration}ms: ${info.messageId}`,
      );

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);

      return {
        success: false,
        messageId: '',
        error: error.message,
      };
    }
  }

  async sendBulk(
    emails: EmailOptions[],
    concurrency: number = 5,
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process in batches to avoid overwhelming the SMTP server
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      const batchPromises = batch.map((email) => this.send(email));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const email = batch[index];

        if (result.status === 'fulfilled' && result.value.success) {
          results.sent++;
        } else {
          results.failed++;
          const error =
            result.status === 'rejected'
              ? result.reason.message
              : result.value.error;
          results.errors.push(`Failed to send to ${email.to}: ${error}`);
        }
      });

      // Small delay between batches
      if (i + concurrency < emails.length) {
        await this.delay(1000);
      }
    }

    this.logger.log(
      `Bulk email completed: ${results.sent} sent, ${results.failed} failed`,
    );
    return results;
  }

  private async getEmailContent(options: EmailOptions): Promise<string> {
    if (options.html) {
      return options.html;
    }

    if (options.template && this.templates.has(options.template)) {
      const template = this.templates.get(options.template);
      return template(options.templateData || {});
    }

    // Default template
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${options.subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${options.subject}</h1>
          </div>
          <div class="content">
            ${options.text ? `<p>${options.text}</p>` : ''}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Our Service'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getFromAddress(): string {
    const fromName =
      process.env.EMAIL_FROM_NAME ||
      process.env.APP_NAME ||
      'Notification System';
    const fromEmail =
      process.env.EMAIL_FROM_ADDRESS ||
      process.env.SMTP_USER ||
      'noreply@example.com';

    return `"${fromName}" <${fromEmail}>`;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('SMTP verification failed:', error);
      return false;
    }
  }

  getStats(): any {
    return {
      // fix this, we might not use nodemailer but mailtrap
      // pool: this.transporter.pool,
      isIdle: this.transporter.isIdle(),
      options: this.transporter.options,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
