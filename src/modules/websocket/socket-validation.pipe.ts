import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { EventEnvelope } from './events/socket.events';

/**
 * Validation pipe for WebSocket events
 * Ensures incoming data matches expected DTO schemas
 */
@Injectable()
export class SocketValidationPipe implements PipeTransform {
  private readonly logger = new Logger(SocketValidationPipe.name);

  async transform(value: any, metadata: ArgumentMetadata) {
    // Skip validation for primitive types
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    // Handle event envelope validation
    if (this.isEventEnvelope(value)) {
      await this.validateEventEnvelope(value);
      return value;
    }

    // Validate against DTO if metatype is provided
    const { metatype } = metadata;
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      this.logger.warn(`Validation failed: ${JSON.stringify(errors)}`);
      throw new WsException({
        error: 'VALIDATION_ERROR',
        message: 'Invalid payload structure',
        details: errors.map((err) => ({
          property: err.property,
          constraints: err.constraints,
        })),
      });
    }

    return object;
  }

  private isEventEnvelope(value: any): value is EventEnvelope {
    return (
      value &&
      typeof value === 'object' &&
      'version' in value &&
      'event' in value
    );
  }

  private async validateEventEnvelope(envelope: EventEnvelope): Promise<void> {
    const errors = await validate(envelope);
    if (errors.length > 0) {
      throw new WsException({
        error: 'INVALID_EVENT_ENVELOPE',
        message: 'Event envelope validation failed',
        details: errors,
      });
    }
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
