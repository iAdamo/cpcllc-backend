import { CreateReviewDto } from '@dto/create-review.dto';
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import {
  Company,
  CompanyDocument,
} from 'src/modules/company/schemas/company.schema';
import { Reviews, ReviewsDocument } from '@schemas/reviews.schema';
import { DbStorageService } from 'src/utils/dbStorage';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Reviews.name) private reviewsModel: Model<ReviewsDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  private readonly storage = new DbStorageService();

  async createReview(
    reviewData: CreateReviewDto,
    userId: string,
    companyId: string,
    images?: Express.Multer.File[],
  ): Promise<Reviews> {
    const newUserId = new Types.ObjectId(userId);
    const newCompanyId = new Types.ObjectId(companyId);
    const user = await this.userModel.findById(newUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const company = await this.companyModel.findById(newCompanyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let imageLinks: string[];
    if (images || images.length !== 0) {
      try {
        const uploadedImageLinks = await this.storage.handleFileUpload(
          companyId.toString(),
          images,
        );
        imageLinks = uploadedImageLinks.map((item) => item.url);
      } catch (error) {
        throw new InternalServerErrorException('Error uploading images');
      }
    }

    // Create the review document
    const review = new this.reviewsModel({
      ...reviewData,
      user: user._id,
      company: company._id,
      images: imageLinks,
    });

    try {
      const savedReview = await review.save();

      // Calculate the new average rating
      const reviews = await this.reviewsModel.find({
        company: newCompanyId,
      });
      const totalRating = reviews.reduce(
        (sum, review) => sum + (review.rating || 0),
        0,
      );
      const averageRating =
        reviews.length > 0 ? totalRating / reviews.length : 0;

      // Update the company's review count and average rating
      await this.companyModel.findByIdAndUpdate(
        companyId,
        {
          $inc: { reviewCount: 1 },
          $set: { averageRating },
        },
        { new: true },
      );
      return savedReview;
    } catch (error) {
      throw new InternalServerErrorException('Error creating review' + error);
    }
  }

  /**
   * Get reviews by company ID
   * @param companyId The ID of the company
   * @returns Array of reviews for the specified company
   */
  async getReviewsByCompanyId(companyId: string): Promise<Reviews[]> {
    if (!Types.ObjectId.isValid(companyId)) {
      throw new BadRequestException('Invalid company ID');
    }
    const reviews = await this.reviewsModel
      .find({ company: new Types.ObjectId(companyId) })
      .sort({ createdAt: -1 })
      .populate('user', 'firstName lastName email profilePicture')
      .populate('company', 'companyName');

    if (!reviews || reviews.length === 0) {
      return [];
    }

    return reviews;
  }

  async deleteReview(reviewId: string): Promise<void> {
    const review = await this.reviewsModel.findByIdAndDelete(reviewId);
    if (review) {
      const companyId = review.company;

      // Recalculate the average rating
      const reviews = await this.reviewsModel.find({ company: companyId });
      const totalRating = reviews.reduce(
        (sum, review) => sum + (review.rating || 0),
        0,
      );
      const averageRating =
        reviews.length > 0 ? totalRating / reviews.length : 0;

      // Update the company's review count and average rating
      await this.companyModel.findByIdAndUpdate(
        companyId,
        {
          $inc: { reviewCount: -1 },
          $set: { averageRating },
        },
        { new: true },
      );
    }
  }
}
