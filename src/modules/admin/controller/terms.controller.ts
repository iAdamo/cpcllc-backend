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
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from '@services/admin.service';
import { Roles } from 'src/common/decorators/guard.decorator';
import { AdminTermsService } from '@admin/service/terms.service';
import { PublishTermsDto } from '@admin/dto/create-terms.dto';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

@ApiTags('Admin')
@Controller('admin')
@Roles('Admin')
export class AdminTermsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminTermsService: AdminTermsService,
  ) {}

  @Post('terms/publish')
  publishTerms(@Body() dto: PublishTermsDto) {
    return this.adminTermsService.publishNewTerms(dto);
  }
}
