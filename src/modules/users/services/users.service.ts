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
import { Company, CompanyDocument } from '@schemas/company.schema';
import { Admin, AdminDocument } from '@schemas/admin.schema';
import { Subcategory, SubcategoryDocument } from '@schemas/service.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { UpdateUserDto } from '@dto/update-user.dto';
import { UpdateCompanyDto } from '@modules/dto/update-company.dto';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { handleFileUpload } from 'src/utils/fileUpload';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
  ) {}

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
        mediaEntries = await handleFileUpload(user.email, files);
      }

      return await this.userModel.findByIdAndUpdate(
        userId,
        {
          ...updateUserDto,
          profilePicture: mediaEntries[0]?.url || user.profilePicture,
        },
        { new: true, runValidators: true },
      );
    } catch (error) {
      console.error('Error updating user:', error);
      throw new InternalServerErrorException(
        'Failed to update user. Please try again later.',
      );
    }
  }

  /**
   * Create or Update a Company
   * @param id User ID
   * @param createCompanyDto Company Data
   * @param files Files to upload
   * @returns Created or Updated Company
   */
  async createCompany(
    userId: string,
    createCompanyDto: CreateCompanyDto,
    files?: {
      profilePicture?: Express.Multer.File[];
      companyImages?: Express.Multer.File[];
    },
  ): Promise<Company> {
    if (!userId) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }

    let validSubcategoryIds: Types.ObjectId[] = [];

    if (typeof createCompanyDto.subcategories === 'string') {
      createCompanyDto.subcategories = JSON.parse(
        createCompanyDto.subcategories,
      );
    }
    if (!Array.isArray(createCompanyDto.subcategories)) {
      throw new BadRequestException('Subcategories must be an array');
    }
    if (
      createCompanyDto.subcategories &&
      createCompanyDto.subcategories.length
    ) {
      const subcategories = await this.subcategoryModel.find({
        _id: {
          $in: createCompanyDto.subcategories.map(
            (id) => new Types.ObjectId(id),
          ),
        },
      });

      if (!subcategories.length) {
        throw new BadRequestException('No valid subcategories found');
      }

      if (subcategories.length !== createCompanyDto.subcategories.length) {
        const invalidIds = createCompanyDto.subcategories.filter(
          (id) => !subcategories.find((s) => s._id.equals(id)),
        );
        throw new BadRequestException(
          `Invalid subcategory IDs: ${invalidIds.join(', ')}`,
        );
      }

      validSubcategoryIds = subcategories.map((s) => s._id);
    }

    let profilePictureUrl: string | null = null;
    let companyImagesUrl: string[] | null = null;

    try {
      if (files?.profilePicture?.length) {
        const [uploaded] = await handleFileUpload(
          userId,
          files.profilePicture[0],
        );
        profilePictureUrl = uploaded?.url || null;
      }

      if (files?.companyImages?.length) {
        const uploadedCompanyImages = await handleFileUpload(
          userId,
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
          lat:
            createCompanyDto.location.primary.coordinates.lat &&
            !isNaN(Number(createCompanyDto.location.primary.coordinates.lat))
              ? Number(createCompanyDto.location.primary.coordinates.lat)
              : null,
          long:
            createCompanyDto.location.primary.coordinates.long &&
            !isNaN(Number(createCompanyDto.location.primary.coordinates.long))
              ? Number(createCompanyDto.location.primary.coordinates.long)
              : null,
        },
        address: {
          zip: createCompanyDto.location.primary.address.zip || '',
          city: createCompanyDto.location.primary.address.city || '',
          state: createCompanyDto.location.primary.address.state || '',
          country: createCompanyDto.location.primary.address.country || '',
          address: createCompanyDto.location.primary.address.address || '',
        },
      },
      secondary: null,
      tertiary: null,
    };

    /** 🔹 Step 4. Upsert Company */
    const companyData = {
      ...createCompanyDto,
      subcategories: validSubcategoryIds,
      owner: userId,
      companyImages: companyImagesUrl,
      location,
    };

    const company = await this.companyModel.findOneAndUpdate(
      { owner: userId },
      { $set: companyData },
      { new: true, upsert: true, runValidators: true },
    );

    /** 🔹 Step 5. Update User Profile Info */
    await this.userModel.findByIdAndUpdate(userId, {
      firstName: createCompanyDto['firstName'],
      lastName: createCompanyDto['lastName'],
      profilePicture: profilePictureUrl,
      activeRole: 'Company',
      activeRoleId: company._id,
    });

    return company;
  }

  /**
   * Update a Company
   * @param userId User ID
   * @param updateCompanyDto Company Data
   * @param files Files to upload
   * @returns Updated Company
   */
  async updateCompany(
    userId: string,
    updateCompanyDto: UpdateCompanyDto,
    files?: {
      profilePicture?: Express.Multer.File[];
      companyImages?: Express.Multer.File[];
    },
  ): Promise<Company> {
    if (!userId) {
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);
    }

    // Initialize update data object
    const companyUpdateData: Partial<UpdateCompanyDto> = {};

    const existingCompany = await this.companyModel.findOne({ owner: userId });

    if (!existingCompany) {
      throw new NotFoundException('Company not found');
    }

    console.log(updateCompanyDto.companySocialMedia.linkedin);
    if (updateCompanyDto.companySocialMedia) {
      const existingSocialMedia = existingCompany.companySocialMedia
        ? JSON.parse(JSON.stringify(existingCompany.companySocialMedia))
        : {};

      companyUpdateData.companySocialMedia = {
        ...existingSocialMedia,
        ...updateCompanyDto.companySocialMedia,
      };
    }

    console.log(companyUpdateData.companySocialMedia);

    // Process subcategories if provided
    if (updateCompanyDto.subcategories) {
      await this.processSubcategories(updateCompanyDto, companyUpdateData);
    }

    // Handle file uploads
    const { profilePictureUrl, companyImagesUrl } =
      await this.handleFileUploads(userId, files);
    if (companyImagesUrl) companyUpdateData.companyImages = companyImagesUrl;

    // Process location data if provided
    this.processLocationData(updateCompanyDto, companyUpdateData);

    // Merge with other DTO data and clean undefined values
    const { companySocialMedia, ...restDto } = updateCompanyDto;
    Object.assign(companyUpdateData, restDto);
    this.cleanUndefinedFields(companyUpdateData);

    // Update company document
    const company = await this.companyModel.findOneAndUpdate(
      { owner: userId },
      { $set: companyUpdateData },
      { new: true, runValidators: true },
    );

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Update user data if needed
    await this.updateUserData(userId, {
      firstName: updateCompanyDto['firstName'],
      lastName: updateCompanyDto['lastName'],
      ...(profilePictureUrl ? { profilePicture: profilePictureUrl } : {}),
    });

    return company;
  }

  // Helper methods:

  private async processSubcategories(
    updateCompanyDto: UpdateCompanyDto,
    companyUpdateData: Partial<UpdateCompanyDto>,
  ): Promise<void> {
    let subcategoriesInput = updateCompanyDto.subcategories;

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

    companyUpdateData.subcategories = subcategories.map((s) =>
      s._id.toString(),
    );
  }

  private async handleFileUploads(
    userId: string,
    files?: {
      profilePicture?: Express.Multer.File[];
      companyImages?: Express.Multer.File[];
    },
  ): Promise<{
    profilePictureUrl: string | null;
    companyImagesUrl: string[] | null;
  }> {
    let profilePictureUrl: string | null = null;
    let companyImagesUrl: string[] | null = null;

    try {
      if (files?.profilePicture?.[0]) {
        const [uploaded] = await handleFileUpload(
          userId,
          files.profilePicture[0],
        );
        profilePictureUrl = uploaded?.url || null;
      }

      if (files?.companyImages?.length) {
        const uploadedCompanyImages = await handleFileUpload(
          userId,
          files.companyImages,
        );
        companyImagesUrl = uploadedCompanyImages.map((item) => item.url);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        this.ERROR_MESSAGES.FILE_UPLOAD_FAILED,
      );
    }

    return { profilePictureUrl, companyImagesUrl };
  }

  private processLocationData(
    updateCompanyDto: UpdateCompanyDto,
    companyUpdateData: Partial<UpdateCompanyDto>,
  ): void {
    if (!updateCompanyDto.location) return;

    const locationTypes = ['primary', 'secondary', 'tertiary'] as const;
    const location: Record<string, any> = {};

    for (const type of locationTypes) {
      const locData = updateCompanyDto.location[type];
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
      companyUpdateData.location = location;
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
    if (!id) {
      throw new BadRequestException('User ID is required');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid User ID format');
    }
    const populatedUser = await this.userModel
      .findOne({
        $or: [
          { _id: new Types.ObjectId(id) },
          { activeRoleId: new Types.ObjectId(id) },
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
      .populate('hiredCompanies')
      .populate({
        path: 'activeRoleId',
        model: 'Company',
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
    return { companies, totalPages };
  }

  /**
   *
   * @param companyId
   * @param userId
   * @returns
   */
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

  async searchCompanies(
    searchInput?: string,
    lat?: string,
    long?: string,
    address?: string,
  ): Promise<Company[]> {
    const radius = 1000; // 1km range
    const filter: any = {};

    const geoConditions: any[] = [];

    // Validate and use coordinates if provided
    if (lat && long) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(long);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new BadRequestException('Invalid Latitude or Longitude');
      }

      geoConditions.push({
        'location.primary.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radius,
          },
        },
      });
    }

    // If address is given (even without search input)
    if (address) {
      //console.log('Address provided:', address);
      geoConditions.push({
        'location.primary.address.address': { $regex: address, $options: 'i' },
      });
    }

    // Text search across companyName or selectedServices
    const textConditions: any[] = [];
    if (searchInput) {
      textConditions.push(
        { selectedServices: { $regex: searchInput, $options: 'i' } },
        { companyName: { $regex: searchInput, $options: 'i' } },
      );
    }

    // Merge filters smartly
    if (geoConditions.length > 0 && textConditions.length > 0) {
      filter.$and = [{ $or: geoConditions }, { $or: textConditions }];
    } else if (geoConditions.length > 0) {
      filter.$or = geoConditions;
    } else if (textConditions.length > 0) {
      filter.$or = textConditions;
    }

    const companies = await this.companyModel.find(filter);

    if (!companies || companies.length === 0) {
      return [];
    }

    return companies;
  }
}
