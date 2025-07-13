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
import { Company, CompanyDocument } from '@schemas/company.schema';
import { Reviews, ReviewsDocument } from '@schemas/reviews.schema';
import { handleFileUpload } from 'src/utils/fileUpload';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Reviews.name) private reviewsModel: Model<ReviewsDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
  ) {}

  async createReview(
    reviewData: CreateReviewDto,
    userId: string,
    companyId: string,
    images?: Express.Multer.File[],
  ): Promise<Reviews> {
    const user = await this.userModel.findById(userId);
    console.log('User:', user);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate company existence
    const company = await this.companyModel.findById(companyId);
    console.log('Company:', company);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let imageLinks: string[];
    if (images || images.length !== 0) {
      try {
        const uploadedImageLinks = await handleFileUpload(
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

    console.log('Review:', review);

    try {
      return await review.save();
    } catch (error) {
      throw new InternalServerErrorException('Error creating review');
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
      .populate('user', 'firstName lastName email profilePicture');

    if (!reviews || reviews.length === 0) {
      return [];
    }

    return reviews;
  }
}
