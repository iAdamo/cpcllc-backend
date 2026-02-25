// deactivation.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Req,
} from '@nestjs/common';
import { DeactivationService } from '../services/deactivation.service';
import { AuthUser } from '@websocket/interfaces/websocket.interface';

@Controller('account')
export class DeactivationController {
  constructor(private readonly deactivationService: DeactivationService) {}

  @Post('deactivate')
  async deactivateAccount(
    @Req() user: AuthUser['user'],
    @Body()
    body: {
      password: string;
      reason: string;
      shouldDeleteAfter30Days?: boolean;
    },
  ) {
    return this.deactivationService.deactivateAccount(user.userId, {
      ...body,
      initiatedBy: 'Client',
    });
  }

  @Post('reactivate')
  async reactivateAccount(@Body() body: { userId: string; password: string }) {
    return this.deactivationService.reactivateAccount(body.userId, {
      password: body.password,
      initiatedBy: 'Client',
    });
  }

  @Post('cancel-deletion')
  async cancelDeletion(
    @Req() user: AuthUser['user'],
    @Body('password') password?: string,
  ) {
    return this.deactivationService.cancelDeletion(user.userId, password);
  }

  @Get('deactivation-status')
  async getDeactivationStatus(@Req() user: AuthUser['user']) {
    return this.deactivationService.getDeactivationStatus(user.userId);
  }
}
