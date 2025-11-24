import { NotificationPayload } from '../interfaces/notification.interface';

export interface NotificationAdapter {
  send(payload: NotificationPayload, options?: any): Promise<void>;
  readonly channel: string;
}

export abstract class BaseAdapter implements NotificationAdapter {
  abstract readonly channel: string;
  abstract send(payload: NotificationPayload, options?: any): Promise<void>;

  protected validatePayload(payload: NotificationPayload): void {
    if (!payload.userId) {
      throw new Error('User ID is required');
    }
    if (!payload.title || !payload.body) {
      throw new Error('Title and body are required');
    }
  }
}
