import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationPriority,
  ActionType,
} from '../interfaces/notification.interface';

export interface NotificationTemplate {
  category: NotificationCategory;
  title: string;
  body: string;
  priority: NotificationPriority;
  actionType?: ActionType;
  defaultChannels: string[];
  ttl?: number; // Time to live in seconds
  variables: string[];
}

export interface TemplateVariables {
  [key: string]: any;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  private readonly templates: Map<NotificationCategory, NotificationTemplate> =
    new Map([
      [
        NotificationCategory.MESSAGE,
        {
          category: NotificationCategory.MESSAGE,
          title: 'New Message',
          body: 'You have a new message from {senderName}',
          priority: NotificationPriority.NORMAL,
          actionType: ActionType.OPEN_CHAT,
          defaultChannels: ['IN_APP', 'PUSH'],
          ttl: 604800, // 7 days
          variables: ['senderName', 'conversationId', 'messageType'],
        },
      ],
      [
        NotificationCategory.PAYMENT,
        {
          category: NotificationCategory.PAYMENT,
          title: 'Payment {status}',
          body: 'Your payment of {amount} for {description} has been {status}',
          priority: NotificationPriority.HIGH,
          actionType: ActionType.VIEW_PAYMENT,
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          ttl: 2592000, // 30 days
          variables: [
            'status',
            'amount',
            'description',
            'transactionId',
            'paymentMethod',
          ],
        },
      ],
      [
        NotificationCategory.JOB_UPDATE,
        {
          category: NotificationCategory.JOB_UPDATE,
          title: 'Job Update: {jobTitle}',
          body: 'Your job "{jobTitle}" has been {status}',
          priority: NotificationPriority.NORMAL,
          actionType: ActionType.VIEW_JOB,
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          ttl: 2592000, // 30 days
          variables: ['jobTitle', 'status', 'jobId', 'updatedBy', 'comments'],
        },
      ],
      [
        NotificationCategory.SYSTEM,
        {
          category: NotificationCategory.SYSTEM,
          title: 'System Notification',
          body: '{message}',
          priority: NotificationPriority.NORMAL,
          actionType: ActionType.OPEN_URL,
          defaultChannels: ['IN_APP'],
          ttl: 86400, // 1 day
          variables: ['message', 'actionUrl', 'system'],
        },
      ],
      [
        NotificationCategory.SECURITY,
        {
          category: NotificationCategory.SECURITY,
          title: 'Security Alert',
          body: 'Security alert: {description}. Please review immediately.',
          priority: NotificationPriority.URGENT,
          actionType: ActionType.OPEN_URL,
          defaultChannels: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'],
          ttl: 86400, // 1 day
          variables: [
            'description',
            'actionUrl',
            'severity',
            'device',
            'location',
          ],
        },
      ],
      [
        NotificationCategory.FRIEND_REQUEST,
        {
          category: NotificationCategory.FRIEND_REQUEST,
          title: 'Friend Request',
          body: '{userName} sent you a friend request',
          priority: NotificationPriority.NORMAL,
          actionType: ActionType.VIEW_PROFILE,
          defaultChannels: ['IN_APP', 'PUSH'],
          ttl: 604800, // 7 days
          variables: ['userName', 'userId', 'profilePicture'],
        },
      ],
      [
        NotificationCategory.ORDER_UPDATE,
        {
          category: NotificationCategory.ORDER_UPDATE,
          title: 'Order #{orderNumber} Update',
          body: 'Your order #{orderNumber} has been {status}',
          priority: NotificationPriority.HIGH,
          actionType: ActionType.NAVIGATE,
          defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
          ttl: 2592000, // 30 days
          variables: [
            'orderNumber',
            'status',
            'trackingNumber',
            'estimatedDelivery',
            'items',
          ],
        },
      ],
      [
        NotificationCategory.COMMENT,
        {
          category: NotificationCategory.COMMENT,
          title: 'New Comment',
          body: '{userName} commented on your {postType}: "{preview}"',
          priority: NotificationPriority.NORMAL,
          actionType: ActionType.NAVIGATE,
          defaultChannels: ['IN_APP', 'PUSH'],
          ttl: 604800, // 7 days
          variables: ['userName', 'postType', 'preview', 'postId', 'commentId'],
        },
      ],
      [
        NotificationCategory.LIKE,
        {
          category: NotificationCategory.LIKE,
          title: 'New Like',
          body: '{userName} liked your {postType}',
          priority: NotificationPriority.LOW,
          actionType: ActionType.NAVIGATE,
          defaultChannels: ['IN_APP'],
          ttl: 604800, // 7 days
          variables: ['userName', 'postType', 'postId', 'likeCount'],
        },
      ],
      [
        NotificationCategory.MARKETING,
        {
          category: NotificationCategory.MARKETING,
          title: '{campaignName}',
          body: '{marketingMessage}',
          priority: NotificationPriority.LOW,
          actionType: ActionType.DEEP_LINK,
          defaultChannels: ['IN_APP', 'EMAIL'],
          ttl: 604800, // 7 days
          variables: [
            'campaignName',
            'marketingMessage',
            'offerCode',
            'expiryDate',
          ],
        },
      ],
    ]);

  getTemplate(category: NotificationCategory): NotificationTemplate {
    const template = this.templates.get(category);

    if (!template) {
      this.logger.warn(
        `No template found for category: ${category}, using default`,
      );
      return this.getDefaultTemplate();
    }

    return template;
  }

  render(
    category: NotificationCategory,
    variables: TemplateVariables,
  ): { title: string; body: string } {
    const template = this.getTemplate(category);

    let title = template.title;
    let body = template.body;

    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const regex = new RegExp(this.escapeRegExp(placeholder), 'g');

      if (title.includes(placeholder)) {
        title = title.replace(regex, String(value));
      }

      if (body.includes(placeholder)) {
        body = body.replace(regex, String(value));
      }
    });

    // Remove any remaining placeholders
    title = this.removeUnusedPlaceholders(title);
    body = this.removeUnusedPlaceholders(body);

    return { title, body };
  }

  validateVariables(
    category: NotificationCategory,
    variables: TemplateVariables,
  ): { valid: boolean; missing: string[] } {
    const template = this.getTemplate(category);
    const requiredVariables = template.variables.filter(
      (v) =>
        template.title.includes(`{${v}}`) || template.body.includes(`{${v}}`),
    );

    const missing = requiredVariables.filter(
      (variable) => !variables.hasOwnProperty(variable),
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  createCustomTemplate(template: NotificationTemplate): void {
    if (this.templates.has(template.category)) {
      this.logger.warn(
        `Overwriting existing template for category: ${template.category}`,
      );
    }

    this.templates.set(template.category, template);
    this.logger.log(
      `Created/updated template for category: ${template.category}`,
    );
  }

  deleteTemplate(category: NotificationCategory): boolean {
    if (category === NotificationCategory.SYSTEM) {
      this.logger.error('Cannot delete system template');
      return false;
    }

    return this.templates.delete(category);
  }

  private getDefaultTemplate(): NotificationTemplate {
    return {
      category: NotificationCategory.SYSTEM,
      title: 'Notification',
      body: '{message}',
      priority: NotificationPriority.NORMAL,
      defaultChannels: ['IN_APP'],
      ttl: 86400,
      variables: ['message'],
    };
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private removeUnusedPlaceholders(text: string): string {
    return text.replace(/\{[^}]+\}/g, '').trim();
  }

  getEmailTemplate(
    title: string,
    body: string,
    actionUrl?: string,
    variables?: TemplateVariables,
  ): string {
    const brandName =
      variables?.brandName || process.env.APP_NAME || 'Our Service';
    const logoUrl = variables?.logoUrl || process.env.APP_LOGO_URL;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9f9f9;
          }

          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }

          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }

          .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 15px;
          }

          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 10px 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }

          .title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #2d3748;
          }

          .body {
            font-size: 16px;
            color: #4a5568;
            margin-bottom: 30px;
            line-height: 1.8;
          }

          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
          }

          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3);
          }

          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
            font-size: 14px;
          }

          .footer a {
            color: #667eea;
            text-decoration: none;
          }

          .unsubscribe {
            margin-top: 10px;
            font-size: 12px;
          }

          @media (max-width: 600px) {
            .container {
              padding: 10px;
            }

            .content {
              padding: 20px;
            }

            .title {
              font-size: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${brandName}" class="logo">` : ''}
            <h1>${brandName}</h1>
          </div>

          <div class="content">
            <h2 class="title">${title}</h2>

            <div class="body">
              ${body.replace(/\n/g, '<br>')}
            </div>

            ${
              actionUrl
                ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${actionUrl}" class="button">View Details</a>
              </div>
            `
                : ''
            }

            <div class="footer">
              <p>© ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
              <p class="unsubscribe">
                <a href="${process.env.UNSUBSCRIBE_URL || '#'}">Unsubscribe from these emails</a> |
                <a href="${process.env.PREFERENCES_URL || '#'}">Manage your preferences</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPushTemplate(
    title: string,
    body: string,
    data?: Record<string, any>,
  ): any {
    return {
      notification: {
        title,
        body,
        icon: data?.icon || '/icon.png',
        badge: data?.badge || '/badge.png',
        image: data?.image,
        vibrate: [100, 50, 100],
        requireInteraction: data?.requireInteraction || false,
        actions: data?.actions || [],
      },
      data: {
        ...data,
        click_action: data?.click_action || 'FLUTTER_NOTIFICATION_CLICK',
        timestamp: new Date().toISOString(),
      },
    };
  }

  getSMSTemplate(
    title: string,
    body: string,
    variables?: TemplateVariables,
  ): string {
    const brand = variables?.brandName || process.env.APP_NAME || '';
    const maxLength = 160; // Standard SMS length

    let sms = `${title}: ${body}`;

    if (brand) {
      sms = `${brand} - ${sms}`;
    }

    // Truncate if too long
    if (sms.length > maxLength) {
      sms = sms.substring(0, maxLength - 3) + '...';
    }

    return sms;
  }
}
