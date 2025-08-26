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
import { ReviewsService } from '@services/reviews.service';
import { CreateReviewDto } from '@dto/create-review.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';

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

  @Post(':providerId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
  async createReview(
    @Body() reviewDto: CreateReviewDto,
    @Param('providerId') providerId: string,
    @Req() req: RequestWithUser,
    @UploadedFiles() files?: { images?: Express.Multer.File[] },
  ) {
    return this.reviewsService.createReview(
      reviewDto,
      req.user.userId,
      providerId,
      files?.images || [],
    );
  }

  @Get(':providerId')
  async getReviews(@Param('providerId') providerId: string) {
    return this.reviewsService.getReviewsByProviderId(providerId);
  }
}
