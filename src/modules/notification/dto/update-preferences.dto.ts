import {
  IsArray,
  IsEnum,
  IsOptional,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationChannel,
  NotificationCategory,
} from '../interfaces/notification.interface';

class QuietHoursDto {
  @IsString()
  start: string;

  @IsString()
  end: string;

  @IsString()
  @IsOptional()
  timezone?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  enabledChannels?: NotificationChannel[];

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationCategory, { each: true })
  mutedCategories?: NotificationCategory[];

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pushTokens?: string[];

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
