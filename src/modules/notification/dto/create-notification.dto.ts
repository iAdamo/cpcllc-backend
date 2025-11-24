import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsObject,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import {
  NotificationCategory,
  NotificationChannel,
  ActionType,
} from '../interfaces/notification.interface';

export class CreateNotificationDto {
  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsEnum(ActionType)
  actionType?: ActionType;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}
