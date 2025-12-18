import { CreateReviewDto } from '@dto/create-review.dto';
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import {
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
import { Reviews, ReviewsDocument } from '@schemas/reviews.schema';
import { DbStorageService } from 'src/common/utils/dbStorage';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Reviews.name) private reviewsModel: Model<ReviewsDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    private readonly storage: DbStorageService,
  ) {}

  async createReview(
    reviewData: CreateReviewDto,
    userId: string,
    id: string,
    files?: { images?: Express.Multer.File[] },
  ): Promise<Reviews> {
    const newUserId = new Types.ObjectId(userId);
    const newOtherId = new Types.ObjectId(id);
    const user = await this.userModel.findById(newUserId);
    if (!user) throw new NotFoundException('User not found');
    const other = await this.userModel.findById(newOtherId);
    if (!user) throw new NotFoundException('User not found');

    let creator: UserDocument;
    let recipient: UserDocument;
    const isClient = user.activeRole === 'Client';

    isClient
      ? ((recipient = other), (creator = user))
      : ((recipient = user), (creator = other));

    const imageLinks = await this.storage.handleFileUploads(
      `reviews/${id.toString()}`,
      files,
    );

    // Create the review document
    const review = new this.reviewsModel({
      ...reviewData,
      creator: creator._id,
      recipient: recipient._id,
      ...imageLinks,
    });

    try {
      const savedReview = await review.save();

      // Calculate the new average rating
      const reviews = await this.reviewsModel.find({
        recipient: recipient._id,
      });
      const totalRating = reviews.reduce(
        (sum, review) => sum + (review.rating || 0),
        0,
      );
      const averageRating =
        reviews.length > 0 ? totalRating / reviews.length : 0;

      // Update the recipient's review count and average rating
      if (isClient) {
        await this.providerModel.findByIdAndUpdate(
          recipient.activeRoleId,
          { $inc: { reviewCount: 1 }, $set: { averageRating } },
          { new: true },
        );
      } else {
        await this.userModel.findByIdAndUpdate(
          recipient._id,
          { $inc: { reviewCount: 1 }, $set: { averageRating } },
          { new: true },
        );
      }
      return (
        await savedReview.populate(
          'creator',
          'firstName lastName profilePicture',
        )
      ).populate('recipient', 'providerName');
    } catch (error) {
      throw new InternalServerErrorException('Error creating review' + error);
    }
  }

  /**
   * Update an existing review. Only the author can update their review.
   * Allows updating rating, message, and appending new images.
   */
  async updateReview(
    reviewId: string,
    userId: string,
    updateData: Partial<CreateReviewDto>,
    files: { images?: Express.Multer.File[] },
  ): Promise<Reviews> {
    const review = await this.reviewsModel.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found');

    // Only author can update their review
    if (review.creator.toString() !== userId) {
      throw new ForbiddenException('Not authorized to update this review');
    }

    // Append new images if provided
    try {
      const uploaded = await this.storage.handleFileUploads(
        `reviews/${review.recipient.toString()}`,
        files,
      );
      const urls = uploaded.map((u) => u.url);
      review.images = Array.isArray(review.images)
        ? review.images.concat(urls)
        : urls;
    } catch (err) {
      throw new InternalServerErrorException('Error uploading images');
    }

    // Update rating/message/note if provided
    if (updateData.rating !== undefined) review.rating = updateData.rating;
    if (updateData.description !== undefined)
      review.description = updateData.description;

    const saved = await review.save();

    // Recalculate recipient/user average rating and reviewCount
    const recipientId = review.recipient;
    const reviews = await this.reviewsModel.find({ recipient: recipientId });
    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Try updating recipient record; if not a recipient, update user record
    const isClient =
      (await this.userModel.findById(userId))?.activeRole === 'Client';
    if (isClient) {
      await this.providerModel.findByIdAndUpdate(
        recipientId,
        { $set: { averageRating }, $inc: { reviewCount: 0 } },
        { new: true },
      );
    } else {
      await this.userModel.findByIdAndUpdate(
        recipientId,
        { $set: { averageRating }, $inc: { reviewCount: 0 } },
        { new: true },
      );
    }
    // const updatedProvider = await this.providerModel.findByIdAndUpdate(
    //   recipientId,
    //   { $set: { averageRating }, $inc: { reviewCount: 0 } },
    //   { new: true },
    // );
    // if (!updatedProvider) {
    //   // fallback to user (if reviews can target a user)
    //   await this.userModel.findByIdAndUpdate(
    //     recipientId,
    //     { $set: { averageRating }, $inc: { reviewCount: 0 } },
    //     { new: true },
    //   );
    // }

    return saved;
  }

  /**
   * Get reviews by recipient ID
   * @param recipientId The ID of the recipient
   * @returns Array of reviews for the specified recipient
   */
  async getReviews(id?: string, user?: string): Promise<Reviews[]> {
    const isNotMe = id && id !== 'me';
    const objId = isNotMe ? user : id;

    if (!Types.ObjectId.isValid(objId)) {
      throw new BadRequestException('Invalid ID');
    }
    let query = {};
    if (isNotMe) {
      query = { recipient: new Types.ObjectId(id) };
    } else if (user) {
      query = { creator: new Types.ObjectId(user) };
    } else {
      throw new BadRequestException('No recipient or user ID provided');
    }

    const reviews = await this.reviewsModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate(
        isNotMe
          ? {
              path: 'creator',
              select: 'firstName lastName profilePicture',
            }
          : {
              path: 'recipient',
              select: 'activeRoleId',
              populate: {
                path: 'activeRoleId',
                select: 'providerName',
              },
            },
      )
      .lean();

    if (!reviews || reviews.length === 0) {
      return [];
    }

    return reviews;
  }

  async deleteReview(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewsModel.findByIdAndDelete(reviewId);
    if (review) {
      const recipientId = review.recipient;

      // Recalculate the average rating
      const reviews = await this.reviewsModel.find({ recipient: recipientId });
      const totalRating = reviews.reduce(
        (sum, review) => sum + (review.rating || 0),
        0,
      );
      const averageRating =
        reviews.length > 0 ? totalRating / reviews.length : 0;

      // Update the recipient's review count and average rating
      const user = await this.userModel.findById(new Types.ObjectId(userId));
      const isClient = user.activeRole === 'Client';
      if (isClient) {
        await this.providerModel.findByIdAndUpdate(
          recipientId,
          {
            $inc: { reviewCount: -1 },
            $set: { averageRating },
          },
          { new: true },
        );
      } else {
        await this.userModel.findByIdAndUpdate(
          recipientId,
          { $inc: { reviewCount: -1 }, $set: { averageRating } },
          { new: true },
        );
      }
    }
  }
}
