import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '@websocket/interfaces/websocket.interface';
import { AuthenticatedSocket } from '@websocket/interfaces/websocket.interface';
import { EventRouterService } from '@websocket/services/event-router.service';
import { PresenceService } from '@presence/presence.service';
import { PresenceEvents } from '@websocket/events/presence.events';
import {
  UpdatePresenceDto,
  SubscribePresenceDto,
} from '@presence/interfaces/presence.interface';

@Injectable()
export class PresenceGateway implements EventHandler {
  private readonly logger = new Logger(PresenceGateway.name);
  private readonly handledEvents = [
    PresenceEvents.UPDATE_PRESENCE,
    PresenceEvents.SUBSCRIBE_PRESENCE,
    PresenceEvents.UNSUBSCRIBE_PRESENCE,
  ];

  constructor(
    private readonly eventRouter: EventRouterService,
    private readonly presenceService: PresenceService,
  ) {}

  onModuleInit() {
    this.handledEvents.forEach((event) => {
      this.eventRouter.registerHandler(event, this);
    });
    this.logger.log('Presence gateway registered with event router');
  }

  canHandle(event: any): boolean {
    return this.handledEvents.includes(event);
  }

  async handle(
    event: string,
    data: any,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const userId = socket.user.userId;

    try {
      switch (event) {
        case PresenceEvents.UPDATE_PRESENCE:
          await this.handleUpdatePresence(userId, data, socket);
          break;

        case PresenceEvents.SUBSCRIBE_PRESENCE:
          await this.handleSubscribePresence(userId, data, socket);
          break;

        case PresenceEvents.UNSUBSCRIBE_PRESENCE:
          await this.handleUnsubscribePresence(userId, data, socket);
          break;

        default:
          this.logger.warn(`Unhandled presence event: ${event}`);
      }
    } catch (error) {
      this.logger.error(`Error handling presence event ${event}:`, error);
      throw error;
    }
  }

  private async handleUpdatePresence(
    userId: string,
    data: UpdatePresenceDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    const presence = await this.presenceService.updatePresence(userId, data);

    // Echo back to sender
    socket.emit(PresenceEvents.PRESENCE_UPDATE, presence);
  }

  private async handleSubscribePresence(
    userId: string,
    data: SubscribePresenceDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    await this.presenceService.subscribeToPresence(userId, data);
  }

  private async handleUnsubscribePresence(
    userId: string,
    data: SubscribePresenceDto,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    await this.presenceService.unsubscribeFromPresence(userId, data);
  }
}
