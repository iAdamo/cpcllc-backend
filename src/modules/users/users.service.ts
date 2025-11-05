import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { model, Model, Types } from 'mongoose';
import { User, UserDocument, sanitizeUser } from '@schemas/user.schema';
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
import { Reviews } from '@modules/schemas/reviews.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { UpdateUserDto } from '@dto/update-user.dto';
import { DbStorageService } from 'src/common/utils/dbStorage';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
    private readonly storage: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  /**
   * Update a User
   * @param id User ID
   * @param updateUserDto User data
   * @param files Files to upload
   * @returns Updated User
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    files: Express.Multer.File | Express.Multer.File[],
  ): Promise<User> {
    try {
      const userId = new Types.ObjectId(id);
      const user = await this.userModel.findById(userId);
      if (!user)
        throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);

      let newProfilePic: any;
      let mediaEntries: any[] = [];
      if (Array.isArray(files) && files.length > 0) {
        mediaEntries = await this.storage.handleFileUpload(
          `${user.email}/profile_picture`,
          files,
        );

        newProfilePic = {
          type: mediaEntries[0].type || 'image',
          url: mediaEntries[0].url,
          thumbnail: mediaEntries[0].thumbnail || null,
          index: mediaEntries[0].index || 0,
        };
      }
      const updatePayload: any = {
        ...updateUserDto,
        profilePicture: newProfilePic,
      };

      // console.log('Update Payload:', updatePayload);

      return await this.userModel
        .findByIdAndUpdate(userId, updatePayload, {
          new: true,
          runValidators: true,
        })
        .populate('hiredCompanies')
        .populate({
          path: 'followedProviders',
          model: 'Provider',
          select: 'providerName providerLogo',
        })
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
        .lean();
    } catch (error) {
      console.error('Error updating user:', error);
      throw new InternalServerErrorException(
        'Failed to update user. Please try again later.',
      );
    }
  }

  /**
   * User Profile
   * @param id User ID
   * @returns User Profile
   */
  async userProfile(id: string): Promise<User> {
    if (!id) {
      throw new BadRequestException('User ID is required');
    }
    // console.log('This is the user id in user profile service: ', id);

    const populatedUser = await this.userModel
      .findOne({
        $and: [
          {
            $or: [
              { _id: new Types.ObjectId(id) },
              { activeRoleId: new Types.ObjectId(id) },
            ],
          },
          { activeRole: { $ne: 'Admin' } },
        ],
      })
      .populate('hiredCompanies')
      .populate({
        path: 'followedProviders',
        model: 'Provider',
        select: 'providerName providerLogo',
      })
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
      .lean();

    if (!populatedUser) {
      throw new NotFoundException('User not found');
    }
    // console.log(populatedUser);

    return sanitizeUser(populatedUser);
  }

  /**
   * Toggle follow/unfollow a provider
   * @param userId User ID
   * @param providerId Provider ID
   * @return Updated User
   */
  async toggleFollowProvider(
    userId: string,
    providerId: string,
  ): Promise<User> {
    if (!userId || !providerId) {
      throw new BadRequestException('User ID and Provider ID are required');
    }
    const userObjectId = new Types.ObjectId(userId);
    const providerObjectId = new Types.ObjectId(providerId);

    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const provider = await this.providerModel.findById(providerObjectId);
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    const isFollowing = user.followedProviders.includes(providerObjectId);

    const userUpdate = isFollowing
      ? {
          $pull: { followedProviders: providerObjectId },
          $inc: { followingCount: -1 },
        }
      : {
          $addToSet: { followedProviders: providerObjectId },
          $inc: { followingCount: 1 },
        };
    const providerUpdate = isFollowing
      ? {
          $pull: { followedBy: userObjectId },
          $inc: { followersCount: -1 },
        }
      : {
          $addToSet: { followedBy: userObjectId },
          $inc: { followersCount: 1 },
        };

    await this.providerModel.findByIdAndUpdate(
      providerObjectId,
      providerUpdate,
    );
    const updatedUser = await this.userModel
      .findByIdAndUpdate(userObjectId, userUpdate, { new: true })
      .populate('hiredCompanies')
      .populate({
        path: 'followedProviders',
        model: 'Provider',
        select: 'providerName providerLogo',
      })
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
      .lean();

    return sanitizeUser(updatedUser);
  }

  async removeMediaFiles(userId: string, fileUrl: string[]): Promise<User> {
    if (!userId || !fileUrl) {
      throw new BadRequestException('User ID and File URL are required');
    }
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    try {
      await this.storage.deleteFilesByUrls(fileUrl);
    } catch (error) {
      throw new InternalServerErrorException('File deletion failed');
    }
    // If the file to be removed is the profile picture, set it to null
    // check for providers too
    if (user.profilePicture && user.profilePicture.url === fileUrl[0]) {
      user.profilePicture = null;
    } else if (user.activeRole === 'Provider' && user.activeRoleId) {
      const provider = await this.providerModel.findById(user.activeRoleId);
      if (provider) {
        const updatedImages = provider.providerImages.filter(
          (img) => !fileUrl.includes(img.url),
        );
        provider.providerImages = updatedImages;
        await provider.save();
      }

      return await user.save();
    }
  }
}
