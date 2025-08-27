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

  // /**
  //  * Create a Provider
  //  * @param id User ID
  //  * @param createProviderDto Provider Data
  //  * @param files Files to upload
  //  * @returns Created or Updated Provider
  //  */
  // async createProvider(
  //   userId: string,
  //   createProviderDto: CreateProviderDto,
  //   files?: {
  //     profilePicture?: Express.Multer.File[];
  //     providerImages?: Express.Multer.File[];
  //   },
  // ): Promise<Provider> {
  //   if (!userId) {
  //     throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
  //   }

  //   let validSubcategoryIds: Types.ObjectId[] = [];

  //   if (typeof createProviderDto.subcategories === 'string') {
  //     createProviderDto.subcategories = JSON.parse(
  //       createProviderDto.subcategories,
  //     );
  //   }
  //   if (!Array.isArray(createProviderDto.subcategories)) {
  //     throw new BadRequestException('Subcategories must be an array');
  //   }
  //   if (
  //     createProviderDto.subcategories &&
  //     createProviderDto.subcategories.length
  //   ) {
  //     const subcategories = await this.subcategoryModel.find({
  //       _id: {
  //         $in: createProviderDto.subcategories.map(
  //           (id) => new Types.ObjectId(id),
  //         ),
  //       },
  //     });

  //     if (!subcategories.length) {
  //       throw new BadRequestException('No valid subcategories found');
  //     }

  //     if (subcategories.length !== createProviderDto.subcategories.length) {
  //       const invalidIds = createProviderDto.subcategories.filter(
  //         (id) => !subcategories.find((s) => s._id.equals(id)),
  //       );
  //       throw new BadRequestException(
  //         `Invalid subcategory IDs: ${invalidIds.join(', ')}`,
  //       );
  //     }

  //     validSubcategoryIds = subcategories.map((s) => s._id);
  //   }

  //   let profilePictureUrl: string | null = null;
  //   let providerImagesUrl: string[] | null = null;

  //   try {
  //     if (files?.profilePicture?.length) {
  //       const [uploaded] = await this.storage.handleFileUpload(
  //         userId,
  //         files.profilePicture[0],
  //       );
  //       profilePictureUrl = uploaded?.url || null;
  //     }

  //     if (files?.providerImages?.length) {
  //       const uploadedProviderImages = await this.storage.handleFileUpload(
  //         userId,
  //         files.providerImages,
  //       );
  //       providerImagesUrl = uploadedProviderImages.map((item) => item.url);
  //     }
  //   } catch (error) {
  //     throw new InternalServerErrorException(
  //       this.ERROR_MESSAGES.FILE_UPLOAD_FAILED,
  //     );
  //   }

  //   this.processLocationData(createProviderDto, createProviderDto);

  //   const providerData = {
  //     ...createProviderDto,
  //     subcategories: validSubcategoryIds,
  //     owner: userId,
  //     providerImages: providerImagesUrl,
  //   };

  //   const provider = await this.providerModel.findOneAndUpdate(
  //     { owner: userId },
  //     { $set: providerData },
  //     { new: true, upsert: true, runValidators: true },
  //   );

  //   /** 🔹 Step 5. Update User Profile Info */
  //   await this.userModel.findByIdAndUpdate(userId, {
  //     firstName: createProviderDto['firstName'],
  //     lastName: createProviderDto['lastName'],
  //     profilePicture: profilePictureUrl,
  //     activeRole: 'Provider',
  //     activeRoleId: provider._id,
  //   });

  //   return provider;
  // }

  /**
   * Update a Provider
   * @param userId User ID
   * @param updateProviderDto Provider Data
   * @param files Files to upload
   * @returns Updated Provider
   */
  async updateProvider(
    userId: string,
    updateProviderDto: UpdateProviderDto,
    files?: {
      providerLogo?: Express.Multer.File[];
      providerImages?: Express.Multer.File[];
    },
  ): Promise<User> {
    if (!userId) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }
    try {
      const existingProvider = await this.providerModel.findOne({
        owner: userId,
      });

      const fileUrls = await this.storage.handleFileUploads(userId, files);

      const updateProviderData = {
        ...updateProviderDto,
        ...fileUrls,
        owner: new Types.ObjectId(userId),
      } as Partial<UpdateProviderDto>;

      const provider = await this.providerModel.findOneAndUpdate(
        { owner: new Types.ObjectId(userId) },
        { $set: updateProviderData },
        {
          new: true,
          upsert: existingProvider ? false : true,
          runValidators: true,
        },
      );

      if (provider) {
        const user = await this.userModel.findByIdAndUpdate(userId, {
          activeRole: 'Provider',
          activeRoleId: provider._id,
        });
        return user;
      }
    } catch (error) {
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
