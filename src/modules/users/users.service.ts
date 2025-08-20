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
  Company,
  CompanyDocument,
} from 'src/modules/company/schemas/company.schema';
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
import { UpdateCompanyDto } from 'src/modules/company/dto/update-company.dto';
import { CreateCompanyDto } from '../company/dto/create-company.dto';
import { DbStorageService } from 'src/utils/dbStorage';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
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
   * Create a User
   * @param createUsersDto User data
   * @returns Created User
   */
  async createUsers(createUsersDto: CreateUserDto): Promise<User> {
    const { email, password } = createUsersDto;

    if (!email || !password) {
      throw new BadRequestException(this.ERROR_MESSAGES.EMAIL_REQUIRED);
    }

    if (await this.userModel.exists({ email })) {
      throw new ConflictException(this.ERROR_MESSAGES.EMAIL_EXISTS);
    }

    return await this.userModel.create(createUsersDto);
  }

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

      let mediaEntries: { url: string }[] = [];
      if (Array.isArray(files) && files.length > 0) {
        mediaEntries = await this.storage.handleFileUpload(user.email, files);
      }

      return await this.userModel.findByIdAndUpdate(
        userId,
        {
          ...updateUserDto,
          profilePicture: mediaEntries[0]?.url || user.profilePicture,
        },
        { new: true, runValidators: true },
      ).exec();
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
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid User ID format');
    }
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
        path: 'activeRoleId',
        model: 'Company',
        populate: {
          path: 'subcategories',
          model: 'Subcategory',
          populate: {
            path: 'category',
            model: 'Category',
          },
        },
      })
      .lean();

    if (!populatedUser) {
      throw new NotFoundException('User not found');
    }
    // console.log(populatedUser);

    return populatedUser;
  }
}
