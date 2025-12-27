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
import { CreateProviderDto } from '@dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { DbStorageService } from 'src/common/utils/dbStorage';

@Injectable()
export class ProviderService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    private readonly storage: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  private processLocationData(locationData: any) {
    if (!locationData) return undefined;

    const processSingleLocation = (loc: any) => {
      if (!loc) return undefined;

      let result: any = {};

      if (loc.address) {
        result.address = loc.address;
      }

      if (loc.coordinates && (loc.coordinates[0] || loc.coordinates[1])) {
        result.coordinates = [
          parseFloat(loc.coordinates[0]) || 0,
          parseFloat(loc.coordinates[1]) || 0,
        ];
        result.type = 'Point';
      }

      return Object.keys(result).length > 0 ? result : undefined;
    };

    const result: any = {};
    if (locationData.primary)
      result.primary = processSingleLocation(locationData.primary);
    if (locationData.secondary)
      result.secondary = processSingleLocation(locationData.secondary);
    if (locationData.tertiary)
      result.tertiary = processSingleLocation(locationData.tertiary);

    return Object.keys(result).length > 0 ? result : undefined;
  }

  async createProvider(
    createProviderDto: CreateProviderDto,
    user: { userId: string; email: string; phoneNumber: string },
    files?: {
      providerLogo?: Express.Multer.File[];
      providerImages?: Express.Multer.File[];
    },
  ): Promise<User> {
    try {
      // Check if provider already exists
      const existingProvider = await this.providerModel.findOne({
        $or: [
          { owner: user.userId },
          { providerEmail: createProviderDto.providerEmail },
          { providerName: createProviderDto.providerName },
          { providerPhoneNumber: createProviderDto.providerPhoneNumber },
        ],
      });

      if (existingProvider) {
        throw new ConflictException(
          'Provider with this email or name already exists',
        );
      }
      const fileUrls = await this.storage.handleFileUploads(
        `${user.email}/provider_images`,
        files,
      );

      // console.log('File URLs after upload:', fileUrls);

      // Map uploaded media to schema fields
      const providerLogoMedia = fileUrls.providerLogo[0] as
        | {
            type: string;
            url: string;
            thumbnail: string;
            index?: number | null;
          }
        | null
        | undefined;
      const providerImagesMedia = fileUrls.providerImages as
        | {
            type: string;
            url: string;
            thumbnail: string | null;
            index?: number;
          }[]
        | undefined;

      // Prepare provider data
      const providerData: any = {
        ...createProviderDto,
        providerLogo: providerLogoMedia || undefined,
        providerImages: providerImagesMedia
          ? providerImagesMedia.map((m) => ({
              type: m.type,
              url: m.url,
              thumbnail: m.thumbnail,
            }))
          : [],
        owner: new Types.ObjectId(user.userId),
        categories:
          createProviderDto.categories?.map((id) => new Types.ObjectId(id)) ||
          [],
        subcategories:
          createProviderDto.subcategories?.map(
            (id) => new Types.ObjectId(id),
          ) || [],
        location: this.processLocationData(createProviderDto.location),
      };

      // Create provider
      const provider = await this.providerModel.create(providerData);

      if (provider) {
        const newUser = await this.userModel
          .findByIdAndUpdate(
            user.userId,
            {
              activeRole: 'Provider',
              activeRoleId: provider._id,
            },
            { new: true },
          )
          .populate({
            path: 'activeRoleId',
            model: 'Provider',
            populate: {
              path: 'subcategories',
              model: 'Subcategory',
              select: 'name description',
              populate: {
                path: 'categoryId',
                model: 'Category',
                select: 'name description',
              },
            },
          });
        return newUser;
      }
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Update a Provider
   * @param userId User ID
   * @param updateProviderDto Provider Data
   * @param files Files to upload
   * @returns Updated Provider
   */
  async updateProvider(
    updateProviderDto: UpdateProviderDto,
    user: { userId: string; email: string; phoneNumber: string },
    files?: {
      providerLogo?: Express.Multer.File[];
      providerImages?: Express.Multer.File[];
    },
  ): Promise<User> {
    try {
      // 1. Check duplicate providers
      const anotherProvider = await this.providerModel.findOne({
        $and: [
          { owner: { $ne: new Types.ObjectId(user.userId) } },
          {
            $or: [
              { providerEmail: updateProviderDto.providerEmail },
              { providerName: updateProviderDto.providerName },
              { providerPhoneNumber: updateProviderDto.providerPhoneNumber },
            ],
          },
        ],
      });
      if (anotherProvider) {
        throw new ConflictException(
          'Another provider with this email or name already exists',
        );
      }

      // 2. Check duplicate users
      const anotherUser = await this.userModel.findOne({
        $and: [
          { _id: { $ne: user.userId } },
          {
            $or: [
              { email: updateProviderDto.providerEmail },
              { phoneNumber: updateProviderDto.providerPhoneNumber },
            ],
          },
        ],
      });
      if (anotherUser) {
        throw new ConflictException(
          'Another user with this email or phone number already exists',
        );
      }

      // 3. Find provider doc
      const provider = await this.providerModel.findOne({
        owner: new Types.ObjectId(user.userId),
      });
      if (!provider) throw new NotFoundException('Provider not found');

      // 4. Upload files (if any)
      const fileUrls = await this.storage.handleFileUploads(
        `${user.email}/provider_images`,
        files,
      );

      // console.log('File URLs after upload:', fileUrls);

      const providerLogoMedia = fileUrls.providerLogo?.[0] as
        | { type: string; url: string; thumbnail?: string | null }
        | null
        | undefined;
      const providerImagesMedia = fileUrls.providerImages as
        | {
            type: string;
            url: string;
            thumbnail?: string | null;
            index?: number;
          }[]
        | undefined;

      // 5. Convert IDs to ObjectId for categories/subcategories
      if (updateProviderDto.categories) {
        updateProviderDto.categories = updateProviderDto.categories.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (updateProviderDto.subcategories) {
        updateProviderDto.subcategories = updateProviderDto.subcategories.map(
          (id) => new Types.ObjectId(id),
        );
      }

      if (updateProviderDto.providerSocialMedia) {
        updateProviderDto.providerSocialMedia = {
          ...provider.providerSocialMedia,
          ...updateProviderDto.providerSocialMedia,
        };
      }

      if (updateProviderDto.location) {
        const newLoc = JSON.parse(
          JSON.stringify(this.processLocationData(updateProviderDto.location)),
        );

        // console.log('Processed Location:', newLoc);

        ['primary', 'secondary', 'tertiary'].forEach((section) => {
          if (newLoc?.[section]) {
            // merge coordinates
            provider.location[section] = {
              ...(provider.location[section] || {}),

              coordinates: newLoc[section].coordinates || {},
              type: 'Point',
              address: {
                ...(provider.location[section]?.address || {}),
                ...(newLoc[section].address || {}),
              },
            };
          }
        });
      }

      // console.log('Final Merged Location:', provider.location);

      // merge other fields normally
      Object.assign(provider, {
        ...updateProviderDto,
        location: provider.location, // keep patched version
      });

      // Apply uploaded media: providerLogo replace, providerImages append
      if (providerLogoMedia) {
        provider.providerLogo = providerLogoMedia;
      }
      if (
        Array.isArray(providerImagesMedia) &&
        providerImagesMedia.length > 0
      ) {
        const newImages = providerImagesMedia.map((m) => ({
          type: m.type,
          url: m.url,
          thumbnail: m.thumbnail,
          index: m.index,
        }));
        provider.providerImages = (provider.providerImages || []).concat(
          newImages as any,
        );
      }

      await provider.save();

      return await this.userModel
        .findById(new Types.ObjectId(user.userId))
        .populate({
          path: 'activeRoleId',
          model: 'Provider',
          populate: {
            path: 'subcategories',
            model: 'Subcategory',
            select: 'name description',
            populate: {
              path: 'categoryId',
              model: 'Category',
              select: 'name description',
            },
          },
        });
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Failed to update provider. Please try again later.',
      );
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
  async toggleFavorite(
    providerId: string,
    userId: string,
  ): Promise<{
    provider: Provider;
    isFavorited: boolean;
    favoriteCount: number;
  }> {
    const userObjectId = new Types.ObjectId(userId);

    const provider = await this.providerModel.findOneAndUpdate(
      { _id: providerId },
      [
        {
          $set: {
            favoritedBy: {
              $cond: [
                { $in: [userObjectId, '$favoritedBy'] },
                { $setDifference: ['$favoritedBy', [userObjectId]] }, // unfavorite
                { $concatArrays: ['$favoritedBy', [userObjectId]] }, // favorite
              ],
            },
          },
        },
      ],
      { new: true },
    );

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const isFavorited = provider.favoritedBy.some((id) =>
      id.equals(userObjectId),
    );

    return {
      provider,
      isFavorited,
      favoriteCount: provider.favoritedBy.length,
    };
  }

  async addFeaturedProvider(providerId: string): Promise<Provider> {
    const provider = await this.providerModel.findByIdAndUpdate(
      providerId,
      { isFeatured: true },
      { new: true },
    );
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    return provider;
  }

  async removeFeaturedProvider(providerId: string): Promise<Provider> {
    const provider = await this.providerModel.findByIdAndUpdate(
      providerId,
      { isFeatured: false },
      { new: true },
    );
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    return provider;
  }

  async getFeaturedProviders(): Promise<Provider[]> {
    return this.providerModel.find({ isFeatured: true }).populate({
      path: 'subcategories',
      model: 'Subcategory',
      select: 'name description',
      populate: {
        path: 'categoryId',
        model: 'Category',
        select: 'name description',
      },
    });
  }
}
