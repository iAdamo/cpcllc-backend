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
      providerLogo?: Express.Multer.File;
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

      if (!updateProviderDto.providerName) {
        throw new BadRequestException(
          'Company name is required for new providers',
        );
      }

      // console.log('Received updateProviderDto:', files);

      let fileUrls: { [key: string]: string | string[] | null } = {};

      // // Handle file uploads
      // if (files && Object.keys(files).length > 0) {
      //   Object.keys(files).forEach((key) => {
      //     if (!files[key] || files[key].length === 0) {
      //       delete files[key];
      //     }
      //   });
      // }
      // console.log('Files after filtering empty entries:', files);
      // if (files && Object.keys(files).length > 0) {
      //   fileUrls = await this.storage.handleFileUploads(userId, files);

      //   // Remove keys with null or undefined values
      //   Object.keys(fileUrls).forEach((key) => {
      //     if (fileUrls[key] == null) {
      //       delete fileUrls[key];
      //     }
      //   });
      // }
      fileUrls = await this.storage.handleFileUploads(userId, files);

      console.log('Processed file URLs:', fileUrls);

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

  // Helper methods:

  private async processSubcategories(
    updateProviderDto: UpdateProviderDto,
    providerUpdateData: Partial<UpdateProviderDto>,
  ): Promise<void> {
    try {
      let subcategoriesInput = updateProviderDto.subcategories;

      if (typeof subcategoriesInput === 'string') {
        subcategoriesInput = JSON.parse(subcategoriesInput);
      }

      if (!Array.isArray(subcategoriesInput)) {
        throw new BadRequestException('Subcategories must be an array');
      }

      if (subcategoriesInput.length === 0) return;

      const subcategoryIds = subcategoriesInput.map(
        (id) => new Types.ObjectId(id),
      );
      const subcategories = await this.subcategoryModel.find({
        _id: { $in: subcategoryIds },
      });

      if (subcategories.length === 0) {
        throw new BadRequestException('No valid subcategories found');
      }

      if (subcategories.length !== subcategoryIds.length) {
        const invalidIds = subcategoriesInput.filter(
          (id) => !subcategories.some((s) => s._id.equals(id)),
        );
        throw new BadRequestException(
          `Invalid subcategory IDs: ${invalidIds.join(', ')}`,
        );
      }

      providerUpdateData.subcategories = subcategories.map((s) =>
        s._id.toString(),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to process subcategories.',
        error,
      );
    }
  }

  private processLocationData(
    updateProviderDto: UpdateProviderDto,
    providerUpdateData: Partial<UpdateProviderDto>,
  ): void {
    try {
      console.log(updateProviderDto);
      if (!updateProviderDto.location) return;

      const locationTypes = ['primary', 'secondary', 'tertiary'] as const;
      const location: Record<string, any> = {};
      console.log('Received location data:', updateProviderDto);
      console.log('Processing location data:', updateProviderDto.location);
      for (const type of locationTypes) {
        const locData = updateProviderDto.location[type];
        if (!locData) continue;

        const coordinates = locData.coordinates
          ? {
              lat: this.parseCoordinate(locData.coordinates.lat),
              long: this.parseCoordinate(locData.coordinates.long),
            }
          : undefined;

        const address = locData.address
          ? {
              zip: locData.address.zip || '',
              city: locData.address.city || '',
              state: locData.address.state || '',
              country: locData.address.country || '',
              address: locData.address.address || '',
            }
          : undefined;

        if (coordinates || address) {
          location[type] = { coordinates, address };
        }
      }

      if (Object.keys(location).length > 0) {
        providerUpdateData.location = location;
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to process location data.',
        error,
      );
    }
  }

  private parseCoordinate(value: any): number | null {
    return value && !isNaN(Number(value)) ? Number(value) : null;
  }

  private cleanUndefinedFields(obj: Record<string, any>): void {
    Object.keys(obj).forEach(
      (key) => obj[key] === undefined && delete obj[key],
    );
  }

  private async updateUserData(
    userId: string,
    userUpdateData: Partial<UpdateUserDto>,
  ): Promise<void> {
    this.cleanUndefinedFields(userUpdateData);

    if (Object.keys(userUpdateData).length > 0) {
      await this.userModel.findByIdAndUpdate(userId, userUpdateData, {
        new: true,
        runValidators: true,
      });
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
