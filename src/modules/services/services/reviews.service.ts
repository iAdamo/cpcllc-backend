import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Reviews } from '@schemas/reviews.schema';
import { Services } from '@schemas/services.schema';
import { CreateReviewDto } from '@dto/create-review.dto';
import { DbStorageService } from '../../../utils/dbStorage';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Reviews.name) private reviewModel: Model<Reviews>,
    @InjectModel(Services.name) private serviceModel: Model<Services>,
    private readonly dbStorageService: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    REVIEW_NOT_FOUND: 'Review not found',
    SERVICE_NOT_FOUND: 'Service not found',
    USER_ID_REQUIRED: 'User id is required',
  };

  /**
   * Handle file upload
   * @param identifier The identifier of the file
   * @param files The file to upload
   * @returns The URL of the uploaded file
   */
  private async handleFileUpload(
    identifier: string,
    files: Express.Multer.File | Express.Multer.File[],
  ): Promise<{ url: string; index: number }[]> {
    const fileArray = Array.isArray(files) ? files : [files]; // Ensure files is always an array

    return Promise.all(
      fileArray.map(async (file, index) => ({
        url:
          process.env.STORAGETYPE === 'local'
            ? await this.dbStorageService.saveFile(identifier, file)
            : 'cloud-storage-url-placeholder', // Implement cloud storage logic
        index,
      })),
    );
  }

  /**
   * Create a Review
   * @param createReviewDto
   * @param files
   * @returns
   */
  async createReview(
    createReviewDto: CreateReviewDto,
    files: Express.Multer.File[],
  ): Promise<Reviews> {
    const { title, description, rating, tags, user, company, service } =
      createReviewDto;

    if (!user) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }

    const review = new this.reviewModel({
      title,
      description,
      rating,
      tags,
      user,
      company,
      service,
    });

    if (files) {
      const uploadedFiles = await this.handleFileUpload(
        `reviews/${review._id}`,
        files,
      );
      review.images = uploadedFiles.map((file) => file.url);
    }

    return review.save();
  }
  
  /**
   * Get a Review by ID
   * @param id
   * @returns
   */
  async getReview(id: string): Promise<Reviews> {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException(this.ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }
    return review;
  }

  /**
   * Get all Reviews
   * @param page
   * @param limit
   * @returns
   */
  async getReviews(page: number, limit: number): Promise<Reviews[]> {
    const skip = (page - 1) * limit;
    return this.reviewModel.find().skip(skip).limit(limit);
  }
  /**
   * Update a Review
   * @param id
   * @param updateReviewDto
   * @returns
   */
  async updateReview(
    id: string,
    updateReviewDto: CreateReviewDto,
  ): Promise<Reviews> {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException(this.ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }

    Object.assign(review, updateReviewDto);
    return review.save();
  }
  /**
   * Delete a Review
   * @param id
   * @returns
   */
  async deleteReview(id: string): Promise<Reviews> {
    const review = await this.reviewModel.findByIdAndDelete(id);
    if (!review) {
      throw new NotFoundException(this.ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }
    return review;
  }
  /**
   * Get Reviews by Company ID
   * @param id
   * @returns
   */
  async getReviewsByCompanyId(id: string): Promise<Reviews[]> {
    const reviews = await this.reviewModel.find({ company: id });
    if (!reviews) {
      throw new NotFoundException(this.ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }
    return reviews;
  }
}
