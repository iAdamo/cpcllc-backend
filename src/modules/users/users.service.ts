import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import { Company, CompanyDocument } from '@schemas/company.schema';
import { Admin, AdminDocument } from '@schemas/admin.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateCompanyUserDto } from './dto/update-company.dto';
import { DbStorageService } from '../../utils/dbStorage';

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
    const { username, email, password } = createUsersDto;

    if (!username || !email || !password) {
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
      companyLogo?: Express.Multer.File[];
    },
  ): Promise<Company> {
    if (!id) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }

    // Check if the user already owns a company
    let existingCompany = await this.companyModel.findOne({ owner: id });

    // Handle file uploads
    const profilePictureUrl = files?.profilePicture?.[0]
      ? await this.dbStorageService.saveFile(id, files.profilePicture[0])
      : null;

    const companyLogoUrl = files?.companyLogo?.[0]
      ? await this.dbStorageService.saveFile(id, files.companyLogo[0])
      : null;

    // Construct the location object
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
      secondary: null, // Set secondary location to null (or populate if needed)
      tertiary: null, // Set tertiary location to null (or populate if needed)
    };

    if (!existingCompany) {
      // Create a new company
      existingCompany = await this.companyModel.create({
        ...createCompanyDto,
        owner: id,
        companyLogo: companyLogoUrl,
        location,
      });
    } else {
      // Update the existing company
      existingCompany = await this.companyModel.findByIdAndUpdate(
        existingCompany._id,
        {
          ...createCompanyDto,
          companyLogo: companyLogoUrl || existingCompany.companyLogo,
          location, // Update the location object
        },
        { new: true, runValidators: true },
      );
    }

    // Update the user's active role to 'Company'
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
        populate: [
          { path: 'clients', select: 'firstName lastName email' },
          {
            path: 'services',
            model: 'Services',
            populate: { path: 'clients', select: 'firstName lastName email' },
          },
        ],
      })
      .exec();

    if (!populatedUser) {
      throw new NotFoundException('User not found');
    }

    return populatedUser;
  }
}
