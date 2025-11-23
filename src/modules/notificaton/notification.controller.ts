import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '@modules/jwt/jwt.guard';
import { ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Presence, PresenceDocument } from '@schemas/presence.schema';
import { NotificationService } from './notification.service';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    phoneNumber: string;
    userId: string;
  };
}

@ApiTags('Notification')
@Controller('notif')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('presence/:userId')
  async getLastSeen(@Param('userId') userId: string) {
    return await this.notificationService.getPresence(userId);
  }
}
