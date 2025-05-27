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
import { Admin, AdminDocument } from '@schemas/admin.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateCompanyUserDto } from './dto/update-company.dto';
import { DbStorageService } from '../../utils/dbStorage';
import path from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    private readonly dbStorageService: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  private async handleFileUpload(
    identifier: string,
    files: Express.Multer.File | Express.Multer.File[],
  ): Promise<{ url: string; index: number }[]> {
    const fileArray = Array.isArray(files) ? files : [files]; // Ensure files is always an array

    return Promise.all(
      fileArray.map(async (file, index) => ({
        url:
          process.env.STORAGETYPE === 'local'
            ? await this.dbStorageService.saveFile(identifier, file)
            : 'cloud-storage-url-placeholder', // Implement cloud storage logic
        index,
      })),
    );
  }

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
    updateUserDto: UpdateCompanyUserDto,
    files: Express.Multer.File | Express.Multer.File[],
  ): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);

    const mediaEntries = await this.handleFileUpload(user.email, files);

    return await this.userModel.findByIdAndUpdate(
      id,
      { ...updateUserDto, profilePicture: mediaEntries[0]?.url },
      { new: true, runValidators: true },
    );
  }

  /**
   * Create or Update a Company
   * @param id User ID
   * @param createCompanyDto Company Data
   * @param files Files to upload
   * @returns Created or Updated Company
   */
  async createCompany(
    id: string,
    createCompanyDto: CreateCompanyDto,
    files?: {
      profilePicture?: Express.Multer.File[];
      companyImages?: Express.Multer.File[];
    },
  ): Promise<Company> {
    if (!id) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }

    let profilePictureUrl: string | null = null;
    let companyImagesUrl: string[] | null = null;

    try {
      // Upload profile picture (use the first one)
      if (files?.profilePicture?.length) {
        const [uploaded] = await this.handleFileUpload(
          id,
          files.profilePicture[0],
        );
        profilePictureUrl = uploaded?.url || null;
      }

      // Upload all company images
      if (files?.companyImages?.length) {
        const uploadedCompanyImages = await this.handleFileUpload(
          id,
          files.companyImages,
        );
        companyImagesUrl = uploadedCompanyImages.map((item) => item.url);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        this.ERROR_MESSAGES.FILE_UPLOAD_FAILED,
      );
    }

    const location = {
      primary: {
        coordinates: {
          lat: createCompanyDto.latitude || null,
          long: createCompanyDto.longitude || null,
        },
        address: {
          zip: createCompanyDto.zip || '',
          city: createCompanyDto.city || '',
          state: createCompanyDto.state || '',
          country: createCompanyDto.country || '',
          address: createCompanyDto.companyAddress || '',
        },
      },
      secondary: null,
      tertiary: null,
    };

    const existingCompany = await this.companyModel.findOneAndUpdate(
      { owner: id },
      {
        $set: {
          ...createCompanyDto,
          owner: id,
          companyImages: companyImagesUrl,
          location,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await this.userModel.findByIdAndUpdate(id, {
      firstName: createCompanyDto['firstName'],
      lastName: createCompanyDto['lastName'],
      profilePicture: profilePictureUrl,
      activeRole: 'Company',
      activeRoleId: existingCompany._id,
    });

    return existingCompany;
  }

  /**
   * Create an Admin
   * @param id User ID
   * @param createAdminDto Admin Data
   * @returns Created Admin
   */
  async createAdmin(
    id: string,
    createAdminDto: CreateAdminDto,
  ): Promise<Admin> {
    if (!id)
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);

    const admin = await this.adminModel.create({ ...createAdminDto, user: id });

    await this.userModel.findByIdAndUpdate(id, {
      activeRole: 'Admin',
      activeRoleId: admin._id,
    });

    return admin;
  }

  /**
   * User Profile
   * @param id User ID
   * @returns User Profile
   */
  async userProfile(id: string): Promise<User> {
    const populatedUser = await this.userModel
      .findById(id)
      .populate('purchasedServices')
      .populate('hiredCompanies')
      .populate({
        path: 'activeRoleId',
        model: 'Company',
        populate: {
          path: 'services',
          model: 'Services',
          select: 'title price media',
        },
      })
      .exec();

    if (!populatedUser) {
      throw new NotFoundException('User not found');
    }

    return populatedUser;
  }

  /**
   * Get all Users
   * @returns List of Users
   */
  async getAllUsers(
    page: string,
    limit: string,
  ): Promise<{ users: User[]; totalPages: number }> {
    const pageN = parseInt(page);
    const limitN = parseInt(limit);

    if (isNaN(pageN) || pageN <= 0) {
      throw new BadRequestException('Page must be a positive number');
    }

    if (isNaN(limitN) || limitN <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }
    const totalUsers = await this.userModel.countDocuments();
    if (totalUsers === 0) {
      return { users: [], totalPages: 0 };
    }
    const totalPages = Math.ceil(totalUsers / limitN);
    const users = await this.userModel
      .find()
      .skip((pageN - 1) * limitN)
      .limit(limitN)
      .populate('purchasedServices')
      .populate('hiredCompanies')
      .populate({
        path: 'activeRoleId',
        model: 'Company',
        populate: {
          path: 'services',
          model: 'Services',
          select: 'title price media',
        },
      })
      .exec();
    return { users, totalPages };
  }

  /**
   * Get all Companies
   * @returns List of Compani
   */
  async getAllCompanies(
    page: string,
    limit: string,
  ): Promise<{ companies: Company[]; totalPages: number }> {
    const pageN = parseInt(page);
    const limitN = parseInt(limit);

    if (isNaN(pageN) || pageN <= 0) {
      throw new BadRequestException('Page must be a positive number');
    }

    if (isNaN(limitN) || limitN <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }

    const totalCompanies = await this.companyModel.countDocuments();
    if (totalCompanies === 0) {
      return { companies: [], totalPages: 0 };
    }

    const totalPages = Math.ceil(totalCompanies / limitN);
    const companies = await this.companyModel.find();
    console.log('Companies:', companies);
    return { companies, totalPages };
  }

  async toggleFavorite(companyId: string, userId: string): Promise<Company> {
    const company = await this.companyModel.findById(companyId);
    if (!company) throw new NotFoundException('User not found');

    const hasFavorited = company.favoritedBy.includes(
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

    return await this.companyModel.findByIdAndUpdate(companyId, update, {
      new: true,
    });
  }
}
