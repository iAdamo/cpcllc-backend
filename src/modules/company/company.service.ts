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
export class CompanyService {
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
   * Create a Company
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
        const [uploaded] = await this.storage.handleFileUpload(
          userId,
          files.profilePicture[0],
        );
        profilePictureUrl = uploaded?.url || null;
      }

      if (files?.companyImages?.length) {
        const uploadedCompanyImages = await this.storage.handleFileUpload(
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

    this.processLocationData(createCompanyDto, createCompanyDto);

    const companyData = {
      ...createCompanyDto,
      subcategories: validSubcategoryIds,
      owner: userId,
      companyImages: companyImagesUrl,
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

    if (updateCompanyDto.companySocialMedia) {
      const existingSocialMedia = existingCompany.companySocialMedia
        ? Object.fromEntries(existingCompany.companySocialMedia)
        : {};

      companyUpdateData.companySocialMedia = {
        ...existingSocialMedia,
        ...updateCompanyDto.companySocialMedia,
      };
    }

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
    // Prevent overwrite
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
    try {
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
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to process subcategories.',
        error,
      );
    }
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
        const [uploaded] = await this.storage.handleFileUpload(
          userId,
          files.profilePicture[0],
        );
        profilePictureUrl = uploaded?.url || null;
      }

      if (files?.companyImages?.length) {
        const uploadedCompanyImages = await this.storage.handleFileUpload(
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
    updateCompanyDto: UpdateCompanyDto | CreateCompanyDto,
    companyUpdateData: Partial<CreateCompanyDto | UpdateCompanyDto>,
  ): void {
    try {
      console.log(updateCompanyDto);
      if (!updateCompanyDto.location) return;

      const locationTypes = ['primary', 'secondary', 'tertiary'] as const;
      const location: Record<string, any> = {};
      console.log('Received location data:', updateCompanyDto);
      console.log('Processing location data:', updateCompanyDto.location);
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
}
