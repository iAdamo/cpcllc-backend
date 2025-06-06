import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Services } from '@schemas/services.schema';
import { Company } from '@schemas/company.schema';
import { CreateServiceDto } from '@dto/create-service.dto';
import { DbStorageService } from '../../../utils/dbStorage';
import { Cache } from 'cache-manager';

@Injectable()
export class ServicesService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectModel(Services.name) private serviceModel: Model<Services>,
    @InjectModel(Company.name) private companyModel: Model<Company>,
    private readonly dbStorageService: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
  };

  private readonly TTL_SECONDS = 6000;

  /**
   * Handle file upload
   * @param identifier The identifier of the file
   * @param files The file to upload
   * @returns The URL of the uploaded file
   */
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
   * Create a Service
   * @param createServiceDto
   * @param files
   * @returns
   */
  async createService(
    createServiceDto: CreateServiceDto,
    files: Express.Multer.File[],
  ): Promise<Services> {
    const { title, description, price, category, company, location } =
      createServiceDto;

    if (
      !title ||
      !description ||
      !price ||
      !category ||
      !company ||
      !location
    ) {
      console.log('error');
      throw new BadRequestException(
        'Title, description, price, category, and company are required',
      );
    }

    // Separate image and video files
    const imageFiles = files.filter((file) =>
      file.mimetype.startsWith('image/'),
    );
    const videoFiles = files.filter((file) =>
      file.mimetype.startsWith('video/'),
    );

    const mediaEntries = await this.handleFileUpload(
      createServiceDto.company.toString(),
      files,
    );

    // Handle image uploads
    const uploadedImages = await this.handleFileUpload(
      createServiceDto.company.toString(),
      imageFiles,
    );

    // Handle video uploads
    const uploadedVideos = await this.handleFileUpload(
      createServiceDto.company.toString(),
      videoFiles,
    );

    // Map uploaded files to the media structure
    createServiceDto.media = {
      image: {
        primary: uploadedImages[0]?.url || null,
        secondary: uploadedImages[1]?.url || null,
        tertiary: uploadedImages[2]?.url || null,
      },
      video: {
        primary: uploadedVideos[0]?.url,
        secondary: uploadedVideos[1]?.url,
        tertiary: uploadedVideos[2]?.url,
      },
    };

    const service = await this.serviceModel.create(createServiceDto);
    if (!service) {
      throw new ConflictException('Service already exists');
    }

    console.log('service', createServiceDto.company);

    await this.companyModel.findByIdAndUpdate(createServiceDto.company, {
      $addToSet: { services: service._id },
    });

    return service;
  }

  /**
   * Update a Service
   * @param id The ID of the service to update
   * @param updateServiceDto The updated service data
   * @param files The files to upload
   * @returns The updated service
   */
  async updateService(
    id: string,
    updateServiceDto: CreateServiceDto,
    files: Express.Multer.File[],
  ): Promise<Services> {
    const service = await this.serviceModel.findById(id);

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Separate image and video files
    const imageFiles = files.filter((file) =>
      file.mimetype.startsWith('image/'),
    );
    const videoFiles = files.filter((file) =>
      file.mimetype.startsWith('video/'),
    );

    // Handle image uploads
    const uploadedImages = await this.handleFileUpload(
      updateServiceDto.company.toString(),
      imageFiles,
    );

    // Handle video uploads
    const uploadedVideos = await this.handleFileUpload(
      updateServiceDto.company.toString(),
      videoFiles,
    );

    // Map uploaded files to the media structure
    updateServiceDto.media = {
      image: {
        primary: uploadedImages[0]?.url || service.media.image.primary,
        secondary: uploadedImages[1]?.url || service.media.image.secondary,
        tertiary: uploadedImages[2]?.url || service.media.image.tertiary,
      },
      video: {
        primary: uploadedVideos[0]?.url || service.media.video.primary,
        secondary: uploadedVideos[1]?.url || service.media.video.secondary,
        tertiary: uploadedVideos[2]?.url || service.media.video.tertiary,
      },
    };

    return await this.serviceModel.findByIdAndUpdate(id, updateServiceDto, {
      new: true,
    });
  }

  /**
   * get services by category
   * @param category category to filter by
   * @returns services in the category
   */
  async getServicesByCategory(category: string): Promise<Services[]> {
    return await this.serviceModel.find({ category }).exec();
  }

  /**
   *
   * @param id service id
   * @returns
   */
  async getServiceById(id: string): Promise<Services> {
    const service = await this.serviceModel
      .findById(id)
      .populate({
        path: 'company', // Populate the company data
        populate: {
          path: 'owner', // Populate the owner (user) data from the company
          select: '_id firstName lastName email profilePicture', // Include specific fields from the User schema
        },
      })
      .exec();

    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async deleteService(id: string): Promise<Services> {
    const service = await this.serviceModel.findById(id);

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return await this.serviceModel.findByIdAndDelete(id);
  }

  /**
   * get all services
   * @param page page number
   * @param limit number of services per page
   * @returns services and total pages
   */
  async getServices(
    page: string,
    limit: string,
  ): Promise<{ services: Services[]; totalPages: number }> {
    const pageN = Number(page);
    const limitN = Number(limit);

    if (!Number.isInteger(pageN) || pageN <= 0) {
      throw new BadRequestException('Page must be a positive integer');
    }

    if (!Number.isInteger(limitN) || limitN <= 0) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    const cacheKey = `services_page_${pageN}_limit_${limitN}`;
    const cached = await this.cacheManager.get<{
      services: Services[];
      totalPages: number;
    }>(cacheKey);
    if (cached) {
      console.log('Cache hit');
      return cached
    }

    console.log('Cache miss');
    const totalCount = await this.serviceModel.countDocuments();
    if (totalCount === 0) {
      return { services: [], totalPages: 0 };
    }

    const totalPages = Math.ceil(totalCount / limitN);
    if (pageN > totalPages) {
      return { services: [], totalPages };
    }

    const skip = (pageN - 1) * limitN;

    const services = await this.serviceModel
      .find()
      .populate({
        path: 'company',
        select: 'owner companyName companyLogo',
      })
      .skip(skip)
      .limit(limitN)
      .exec();

    const result = { services, totalPages };
    // ts-error ignore
    const data = await this.cacheManager.set(cacheKey, result, this.TTL_SECONDS);
    // console.log(data);

    return result;
  }

  /**
   * search services
   * @param search search query
   * @returns services matching the search query
   */
  async searchServices(search: string): Promise<Services[]> {
    return await this.serviceModel
      .find({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ],
      })
      .exec();
  }

  /**
   * get random services
   * @param count number of services to return
   * @returns random services
   */

  async getRandomServices(
    page: string,
    limit: string,
  ): Promise<{ services: Services[]; totalPages: number }> {
    const pageN = parseInt(page);
    const limitN = parseInt(limit);

    if (isNaN(pageN) || pageN <= 0) {
      throw new BadRequestException('Page must be a positive number');
    }

    if (isNaN(limitN) || limitN <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }

    const totalCount = await this.serviceModel.countDocuments(); // Get total services count
    if (totalCount === 0) {
      return { services: [], totalPages: 0 };
    }

    const totalPages = Math.ceil(totalCount / limitN); // Calculate total pages
    const skip = (pageN - 1) * limitN;

    // Randomly shuffle all documents and apply pagination
    const services = await this.serviceModel.aggregate([
      { $sample: { size: limitN } },
      { $skip: skip },
      { $limit: limitN },
    ]);

    return { services, totalPages };
  }

  async toggleFavorite(serviceId: string, userId: string): Promise<Services> {
    const service = await this.serviceModel.findById(serviceId);
    if (!service) throw new NotFoundException('Service not found');

    const hasFavorited = service.favoritedBy.includes(
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

    await this.serviceModel.updateOne({ _id: serviceId }, update);

    return await this.serviceModel.findById(serviceId);
  }
}
