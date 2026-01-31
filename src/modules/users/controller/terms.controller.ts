import { Controller, Post, Body, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TermsService } from '@users/service/terms.service';
import { SkipTerms } from 'src/common/decorators/guard.decorator';
import { AuthUser } from '@websocket/interfaces/websocket.interface';
import { AcceptTermsDto } from '@users/dto/accept-terms.dto';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
    phoneNumber?: string;
  };
}

@ApiTags('Terms')
@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Post('decide')
  @SkipTerms()
  async acceptTerms(@Req() req: AuthUser, @Body() dto: AcceptTermsDto[]) {
    const user = req.user;

    return this.termsService.decideLatestTermsBatch(user.userId, dto);
  }
}
