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
import { User } from '@schemas/user.schema';
import { ReviewsService } from '@modules/services/reviews.service';
import { CreateUserDto } from '@modules/dto/create-user.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { CreateReviewDto } from '@modules/dto/create-review.dto';
import { UpdateCompanyDto } from '@dto/update-company.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { Company } from '@schemas/company.schema';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':companyId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
  async createReview(
    @Body() reviewDto: CreateReviewDto,
    @Param('companyId') companyId: string,
    @Req() req: RequestWithUser,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reviewsService.createReview(
      reviewDto,
      req.user.userId,
      companyId,
      files?.images || [],
    );
  }

  @Get(':companyId')
  async getReviews(@Param('companyId') companyId: string) {
    return this.reviewsService.getReviewsByCompanyId(companyId);
  }
}
