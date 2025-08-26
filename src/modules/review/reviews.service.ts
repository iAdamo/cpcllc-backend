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
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
import { Reviews, ReviewsDocument } from '@schemas/reviews.schema';
import { DbStorageService } from 'src/utils/dbStorage';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Reviews.name) private reviewsModel: Model<ReviewsDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
  ) {}

  private readonly storage = new DbStorageService();

  async createReview(
    reviewData: CreateReviewDto,
    userId: string,
    providerId: string,
    images?: Express.Multer.File[],
  ): Promise<Reviews> {
    const newUserId = new Types.ObjectId(userId);
    const newProviderId = new Types.ObjectId(providerId);
    const user = await this.userModel.findById(newUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const provider = await this.providerModel.findById(newProviderId);
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    let imageLinks: string[];
    if (images || images.length !== 0) {
      try {
        const uploadedImageLinks = await this.storage.handleFileUpload(
          providerId.toString(),
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
      provider: provider._id,
      images: imageLinks,
    });

    try {
      const savedReview = await review.save();

      // Calculate the new average rating
      const reviews = await this.reviewsModel.find({
        provider: newProviderId,
      });
      const totalRating = reviews.reduce(
        (sum, review) => sum + (review.rating || 0),
        0,
      );
      const averageRating =
        reviews.length > 0 ? totalRating / reviews.length : 0;

      // Update the provider's review count and average rating
      await this.providerModel.findByIdAndUpdate(
        providerId,
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
   * Get reviews by provider ID
   * @param providerId The ID of the provider
   * @returns Array of reviews for the specified provider
   */
  async getReviewsByProviderId(providerId: string): Promise<Reviews[]> {
    if (!Types.ObjectId.isValid(providerId)) {
      throw new BadRequestException('Invalid provider ID');
    }
    const reviews = await this.reviewsModel
      .find({ provider: new Types.ObjectId(providerId) })
      .sort({ createdAt: -1 })
      .populate('user', 'firstName lastName email profilePicture')
      .populate('provider', 'providerName');

    if (!reviews || reviews.length === 0) {
      return [];
    }

    return reviews;
  }

  async deleteReview(reviewId: string): Promise<void> {
    const review = await this.reviewsModel.findByIdAndDelete(reviewId);
    if (review) {
      const providerId = review.provider;

      // Recalculate the average rating
      const reviews = await this.reviewsModel.find({ provider: providerId });
      const totalRating = reviews.reduce(
        (sum, review) => sum + (review.rating || 0),
        0,
      );
      const averageRating =
        reviews.length > 0 ? totalRating / reviews.length : 0;

      // Update the provider's review count and average rating
      await this.providerModel.findByIdAndUpdate(
        providerId,
        {
          $inc: { reviewCount: -1 },
          $set: { averageRating },
        },
        { new: true },
      );
    }
  }
}
