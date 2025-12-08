import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SocketEvents, EventEnvelope } from '../events/socket.events';
import {
  AuthenticatedSocket,
  EventHandler,
} from '../interfaces/websocket.interface';

/**
 * Central event router that dispatches events to appropriate module handlers
 * Provides a plugin architecture for modules to register their event handlers
 */
@Injectable()
export class EventRouterService {
  private readonly logger = new Logger(EventRouterService.name);
  private readonly eventHandlers = new Map<string, EventHandler>();

  constructor() {}

  /**
   * Register event handler from modules
   */
  registerHandler(pattern: string, handler: EventHandler): void {
    this.eventHandlers.set(pattern, handler);
    // this.logger.log(`Registered event handler for pattern: ${pattern}`);
  }

  /**
   * Route incoming event to appropriate handler
   */
  async route(
    event: string,
    data: EventEnvelope,
    socket: AuthenticatedSocket,
  ): Promise<void> {
    try {
      // Validate event envelope
      this.validateEventEnvelope(data);

      // Find appropriate handler
      const handler = this.findHandlerForEvent(event);

      if (!handler) {
        this.logger.warn(`No handler found for event: ${event}`);
        socket.emit(SocketEvents.ERROR, {
          error: 'NO_HANDLER_FOUND',
          message: `No handler found for event: ${event}`,
          event,
        });
        return;
      }

      // Execute handler
      await handler.handle(event, data.payload, socket);

      this.logger.debug(
        `Successfully routed event: ${event} for user ${socket.user.userId}`,
      );
    } catch (error: any) {
      this.logger.error(`Error routing event ${event}:`, error);

      socket.emit(SocketEvents.ERROR, {
        error: 'EVENT_ROUTING_ERROR',
        message: error.message,
        event,
      });
    }
  }

  /**
   * Find handler for specific event
   */
  private findHandlerForEvent(event: string): EventHandler | null {
    // Direct match
    if (this.eventHandlers.has(event)) {
      return this.eventHandlers.get(event);
    }

    // Pattern matching (e.g., 'chat:*')
    for (const [pattern, handler] of this.eventHandlers.entries()) {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        if (new RegExp(`^${regexPattern}$`).test(event)) {
          return handler;
        }
      }
    }

    return null;
  }

  /**
   * Validate event envelope structure and version
   */
  private validateEventEnvelope(envelope: EventEnvelope): void {
    if (!envelope.version) {
      throw new Error('Event envelope missing version');
    }

    if (!envelope.event) {
      throw new Error('Event envelope missing event type');
    }

    if (!envelope.timestamp) {
      throw new Error('Event envelope missing timestamp');
    }

    // Add version compatibility checks here
    // This allows for backward compatibility strategies
  }

  /**
   * Get all registered event patterns
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.eventHandlers.keys());
  }
}
