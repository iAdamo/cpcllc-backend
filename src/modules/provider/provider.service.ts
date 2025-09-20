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
import { UpdateProviderDto } from '@dto/update-provider.dto';
import { DbStorageService } from 'src/utils/dbStorage';
import { LocationDto } from './dto/update-location.dto';

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
    if (!user.userId) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }

    try {
      // find existing provider
      const existingProvider = await this.providerModel.findOne({
        owner: user.userId,
      });

      // conflict checks only if you are updating (existingProvider)
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

      // handle file uploads (returns { providerLogo: 'url', providerImages: ['url'] })
      const fileUrls = await this.storage.handleFileUploads(user.userId, files);

      let location = updateProviderDto.location || {};
      console.log('dto location data:', updateProviderDto);
      console.log('Raw location data:', location);
      function removeDotNotationKeys(
        obj: Record<string, any>,
      ): Record<string, any> {
        return Object.fromEntries(
          Object.entries(obj).filter(([k]) => !k.startsWith('location.')),
        );
      }
      function dotToNested(obj: Record<string, any>): any {
        const result = {};
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          const keys = key.split('.');
          keys.reduce((acc, k, i) => {
            if (i === keys.length - 1) {
              acc[k] = obj[key];
              return;
            }
            if (!acc[k]) acc[k] = {};
            return acc[k];
          }, result);
        }
        return result;
      }

      if (
        Object.keys(location).length === 0 &&
        Object.keys(updateProviderDto).some((k) => k.startsWith('location.'))
      ) {
        location =
          dotToNested(
            Object.fromEntries(
              Object.entries(updateProviderDto).filter(([k]) =>
                k.startsWith('location.'),
              ),
            ),
          ).location || {};
      }
      const buildLocation = (loc: any): LocationDto | undefined => {
        if (
          loc?.coordinates?.lat !== undefined &&
          loc?.coordinates?.long !== undefined
        ) {
          const lat = parseFloat(loc.coordinates.lat);
          const long = parseFloat(loc.coordinates.long);

          return {
            coordinates: {
              // matches CoordinatesDto
              type: 'Point',
              coordinates: [long, lat],
            },
            address: loc.address ? { ...loc.address } : undefined,
          };
        }
        return undefined;
      };

      location = {
        primary: buildLocation(location.primary),
        secondary: buildLocation(location.secondary),
        tertiary: buildLocation(location.tertiary),
      };
      console.log('Processed location data:', location);
      // Remove dot-notation location keys from DTO
      const cleanedDto = removeDotNotationKeys(updateProviderDto);

      const updateProviderData: Partial<UpdateProviderDto> = {
        ...cleanedDto,
        ...fileUrls,
        owner: new Types.ObjectId(user.userId),
        categories:
          updateProviderDto.categories?.map((id) => new Types.ObjectId(id)) ||
          [],
        subcategories:
          updateProviderDto.subcategories?.map(
            (id) => new Types.ObjectId(id),
          ) || [],
        location,
      };

      // upsert if not existing, update if existing
      const update: any = {
        ...cleanedDto,
        ...fileUrls,
        owner: new Types.ObjectId(user.userId),
        categories: updateProviderDto.categories?.map(
          (id) => new Types.ObjectId(id),
        ),
        subcategories: updateProviderDto.subcategories?.map(
          (id) => new Types.ObjectId(id),
        ),
      };

      // Only set subfields if they are fully defined
      if (
        location.primary &&
        location.primary.coordinates &&
        Array.isArray(location.primary.coordinates.coordinates)
      ) {
        update['location.primary'] = location.primary;
      }
      if (
        location.secondary &&
        location.secondary.coordinates &&
        Array.isArray(location.secondary.coordinates.coordinates)
      ) {
        update['location.secondary'] = location.secondary;
      }
      if (
        location.tertiary &&
        location.tertiary.coordinates &&
        Array.isArray(location.tertiary.coordinates.coordinates)
      ) {
        update['location.tertiary'] = location.tertiary;
      }

      // REMOVE the top-level location field if any subfield is being updated
      delete update.location;
      
      console.log('Final update object:', update);
      const provider = await this.providerModel.findOneAndUpdate(
        { owner: new Types.ObjectId(user.userId) },
        { $set: update },
        { new: true, upsert: !existingProvider, runValidators: true },
      );
      if (provider) {
        // update activeRole in user doc
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
          })
          .exec();

        return newUser;
      }
      throw new InternalServerErrorException('Provider not created/updated');
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
