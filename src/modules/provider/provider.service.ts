import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { model, Model, Types } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import {
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
import {
  Service,
  Category,
  Subcategory,
  ServiceDocument,
  CategoryDocument,
  SubcategoryDocument,
} from '@modules/schemas/service.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { UpdateUserDto } from '@dto/update-user.dto';
import { UpdateProviderDto } from '@dto/update-provider.dto';
import { DbStorageService } from 'src/utils/dbStorage';

@Injectable()
export class ProviderService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
  ) {}

  private readonly storage = new DbStorageService();

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  /**
   * Update a Provider
   * @param userId User ID
   * @param updateProviderDto Provider Data
   * @param files Files to upload
   * @returns Updated Provider
   */
  async updateProvider(
    user: { userId: string; email: string; phoneNumber: string },
    updateProviderDto: UpdateProviderDto,
    files?: {
      providerLogo?: Express.Multer.File[];
      providerImages?: Express.Multer.File[];
    },
  ): Promise<User> {
    console.log('UpdateProviderDto:', updateProviderDto);
    if (!user.userId) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }
    try {
      const existingProvider = await this.providerModel.findOne({
        owner: user.userId,
      });

      if (existingProvider) {
        if (
          await this.userModel.findOne({
            email: existingProvider.providerEmail,
            _id: { $ne: user.userId },
          })
        ) {
          throw new ConflictException('Email already in use');
        }

        if (
          await this.userModel.findOne({
            phoneNumber: existingProvider.providerPhoneNumber,
            _id: { $ne: user.userId },
          })
        ) {
          throw new ConflictException('Phone number already in use');
        }
      }

      const fileUrls = await this.storage.handleFileUploads(user.userId, files);

      const updateProviderData = {
        ...updateProviderDto,
        ...fileUrls,
        owner: new Types.ObjectId(user.userId),
      } as Partial<UpdateProviderDto>;

        // const updateProviderData = {
        //   ...updateProviderDto,
        //   ...fileUrls,
        //   owner: new Types.ObjectId(user.userId),
        //   categories: updateProviderDto.categories
        //     ? updateProviderDto.categories.map((id) => new Types.ObjectId(id))
        //     : [],
        //   subcategories: updateProviderDto.subcategories
        //     ? updateProviderDto.subcategories.map(
        //         (id) => new Types.ObjectId(id),
        //       )
        //     : [],
        // } as Partial<UpdateProviderDto>;


      const provider = await this.providerModel.findOneAndUpdate(
        { owner: new Types.ObjectId(user.userId) },
        { $set: updateProviderData },
        {
          new: true,
          upsert: existingProvider ? false : true,
          runValidators: true,
        },
      );

      if (provider) {
        const newUser = await this.userModel.findByIdAndUpdate(user.userId, {
          activeRole: 'Provider',
          activeRoleId: provider._id,
        });
        return newUser;
      }
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Get all Companies
   * @returns List of Compani
   */
  async getAllCompanies(
    page: string,
    limit: string,
  ): Promise<{ companies: Provider[]; totalPages: number }> {
    const pageN = parseInt(page);
    const limitN = parseInt(limit);

    if (isNaN(pageN) || pageN <= 0) {
      throw new BadRequestException('Page must be a positive number');
    }

    if (isNaN(limitN) || limitN <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }

    const totalCompanies = await this.providerModel.countDocuments();
    if (totalCompanies === 0) {
      return { companies: [], totalPages: 0 };
    }

    const totalPages = Math.ceil(totalCompanies / limitN);
    const companies = await this.providerModel.find();
    return { companies, totalPages };
  }

  /**
   *
   * @param providerId
   * @param userId
   * @returns
   */
  async toggleFavorite(providerId: string, userId: string): Promise<Provider> {
    const provider = await this.providerModel.findById(providerId);
    if (!provider) throw new NotFoundException('User not found');

    const hasFavorited = provider.favoritedBy.includes(
      new Types.ObjectId(userId),
    );

    const update = hasFavorited
      ? {
          $pull: { favoritedBy: userId },
          $inc: { favoriteCount: -1 },
        }
      : {
          $addToSet: { favoritedBy: userId },
          $inc: { favoriteCount: 1 },
        };

    return await this.providerModel.findByIdAndUpdate(providerId, update, {
      new: true,
    });
  }
}
