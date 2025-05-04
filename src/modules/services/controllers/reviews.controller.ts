import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReviewsService } from '../services/reviews.service';
import { CreateReviewDto } from '@dto/create-review.dto';
import { ApiTags } from '@nestjs/swagger';
import { Services } from '@schemas/services.schema';
import { Reviews } from '@schemas/reviews.schema';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'primary', maxCount: 1 },
      { name: 'secondary', maxCount: 1 },
      { name: 'tertiary', maxCount: 1 },
    ]),
  )
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @UploadedFiles()
    files: {
      primary?: Express.Multer.File[];
      secondary?: Express.Multer.File[];
      tertiary?: Express.Multer.File[];
    },
  ) {
    // Validate that at least the primary image is provided
    if (!files || !files.primary || files.primary.length === 0) {
      throw new BadRequestException('Primary image is required');
    }

    // Map the files to the `media` structure expected by the service
    const fileArray: Express.Multer.File[] = [
      ...(files.primary || []),
      ...(files.secondary || []),
      ...(files.tertiary || []),
    ];

    return this.reviewsService.createReview(createReviewDto, fileArray);
  }
  @Get(':id')
  async getReview(@Param('id') id: string): Promise<Reviews> {
    return this.reviewsService.getReview(id);
  }
  @Get('')
  async getReviews(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ): Promise<Reviews[]> {
    return this.reviewsService.getReviews(page, limit);
  }
  @Patch(':id')
  async updateReview(
    @Param('id') id: string,
    @Body() updateReviewDto: CreateReviewDto,
  ): Promise<Reviews> {
    return this.reviewsService.updateReview(id, updateReviewDto);
  }
  @Delete(':id')
  async deleteReview(@Param('id') id: string): Promise<Reviews> {
    return this.reviewsService.deleteReview(id);
  }
  @Get('company/:id')
  async getReviewsByCompanyId(@Param('id') id: string): Promise<Reviews[]> {
    return this.reviewsService.getReviewsByCompanyId(id);
  }
}
