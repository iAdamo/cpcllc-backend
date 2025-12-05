import {
  NotificationCategory,
  ActionType,
} from '../interfaces/notification.interface';

export interface NotificationTemplate {
  category: NotificationCategory;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actionType?: ActionType;
  channels?: string[];
  ttl?: number; // Time to live in seconds
}

export const NOTIFICATION_TEMPLATES: Record<
  NotificationCategory,
  NotificationTemplate
> = {
  [NotificationCategory.MESSAGE]: {
    category: NotificationCategory.MESSAGE,
    title: 'New Message',
    body: 'You have a new message from {senderName}',
    priority: 'normal',
    actionType: ActionType.OPEN_CHAT,
    channels: ['inapp', 'push'],
    ttl: 604800, // 7 days
  },

  [NotificationCategory.PAYMENT]: {
    category: NotificationCategory.PAYMENT,
    title: 'Payment {status}',
    body: 'Your payment of {amount} has been {status}',
    priority: 'high',
    actionType: ActionType.VIEW_PAYMENT,
    channels: ['inapp', 'email', 'push'],
    ttl: 2592000, // 30 days
  },

  [NotificationCategory.JOB_UPDATE]: {
    category: NotificationCategory.JOB_UPDATE,
    title: 'Job Update: {jobTitle}',
    body: 'Your job "{jobTitle}" has been {status}',
    priority: 'normal',
    actionType: ActionType.VIEW_JOB,
    channels: ['inapp', 'email', 'push'],
    ttl: 2592000,
  },

  [NotificationCategory.SYSTEM]: {
    category: NotificationCategory.SYSTEM,
    title: 'System Notification',
    body: '{message}',
    priority: 'normal',
    actionType: ActionType.OPEN_URL,
    channels: ['inapp'],
    ttl: 86400, // 1 day
  },

  [NotificationCategory.SECURITY]: {
    category: NotificationCategory.SECURITY,
    title: 'Security Alert',
    body: 'Security alert: {description}',
    priority: 'urgent',
    actionType: ActionType.OPEN_URL,
    channels: ['inapp', 'email', 'sms'],
    ttl: 86400,
  },

  [NotificationCategory.MARKETING]: {
    category: NotificationCategory.MARKETING,
    title: '{campaignName}',
    body: '{marketingMessage}',
    priority: 'low',
    actionType: ActionType.DEEP_LINK,
    channels: ['inapp', 'email'],
    ttl: 604800,
  },

  [NotificationCategory.FRIEND_REQUEST]: {
    category: NotificationCategory.FRIEND_REQUEST,
    title: 'Friend Request',
    body: '{userName} sent you a friend request',
    priority: 'normal',
    actionType: ActionType.VIEW_PROFILE,
    channels: ['inapp', 'push'],
    ttl: 604800,
  },

  [NotificationCategory.ORDER_UPDATE]: {
    category: NotificationCategory.ORDER_UPDATE,
    title: 'Order Update',
    body: 'Your order #{orderId} has been {status}',
    priority: 'high',
    actionType: ActionType.NAVIGATE,
    channels: ['inapp', 'email', 'push'],
    ttl: 2592000,
  },

  [NotificationCategory.COMMENT]: {
    category: NotificationCategory.COMMENT,
    title: 'New Comment',
    body: '{userName} commented on your {postType}',
    priority: 'normal',
    actionType: ActionType.NAVIGATE,
    channels: ['inapp', 'push'],
    ttl: 604800,
  },

  [NotificationCategory.LIKE]: {
    category: NotificationCategory.LIKE,
    title: 'New Like',
    body: '{userName} liked your {postType}',
    priority: 'low',
    actionType: ActionType.NAVIGATE,
    channels: ['inapp'],
    ttl: 604800,
  },
};

export class TemplateService {
  static getTemplate(
    category: NotificationCategory,
    variables: Record<string, any> = {},
  ): NotificationTemplate {
    const template = NOTIFICATION_TEMPLATES[category];

    if (!template) {
      throw new Error(`No template found for category: ${category}`);
    }

    // Replace variables in title and body
    const processedTemplate = { ...template };

    if (variables) {
      Object.keys(variables).forEach((key) => {
        const value = variables[key];
        const regex = new RegExp(`{${key}}`, 'g');

        if (processedTemplate.title.includes(`{${key}}`)) {
          processedTemplate.title = processedTemplate.title.replace(
            regex,
            value,
          );
        }

        if (processedTemplate.body.includes(`{${key}}`)) {
          processedTemplate.body = processedTemplate.body.replace(regex, value);
        }
      });
    }

    return processedTemplate;
  }

  static createNotificationFromTemplate(
    category: NotificationCategory,
    userId: string,
    variables: Record<string, any> = {},
    overrides: Partial<NotificationTemplate> = {},
  ) {
    const template = this.getTemplate(category, variables);

    return {
      userId,
      title: template.title,
      body: template.body,
      category: template.category,
      priority: overrides.priority || template.priority,
      actionType: overrides.actionType || template.actionType,
      channels: overrides.channels || template.channels,
      meta: {
        ...variables,
        template: category,
      },
      expiresAt: template.ttl
        ? new Date(Date.now() + template.ttl * 1000)
        : undefined,
    };
  }
}
