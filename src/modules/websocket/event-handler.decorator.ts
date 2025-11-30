import { SetMetadata } from '@nestjs/common';

export const EVENT_HANDLER_METADATA = 'event_handler';
export const EVENT_PATTERN_METADATA = 'event_pattern';

/**
 * Decorator to mark methods as event handlers
 */
export const EventHandler = (pattern: string) =>
  SetMetadata(EVENT_HANDLER_METADATA, pattern);

/**
 * Decorator for extracting user from socket
 */
export const SocketUser =
  () => (target: any, propertyKey: string, parameterIndex: number) => {
    const existingMetadata =
      Reflect.getMetadata(SOCKET_USER_METADATA, target.constructor) || [];

    existingMetadata.push({
      propertyKey,
      parameterIndex,
    });

    Reflect.defineMetadata(
      SOCKET_USER_METADATA,
      target.constructor,
      existingMetadata,
    );
  };

export const SOCKET_USER_METADATA = 'socket_user';
