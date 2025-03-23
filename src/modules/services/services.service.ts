import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Services } from '@schemas/services.schema';
import { CreateServiceDto } from '@dto/create-service.dto';
import { DbStorageService } from '../../utils/dbStorage';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Services.name) private serviceModel: Model<Services>,
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

  async createService(
    createServiceDto: CreateServiceDto,
    files: Express.Multer.File[],
  ): Promise<Services> {
    const { title, description, price, category, company } = createServiceDto;

    if (!title || !description || !price || !category || !company) {
      throw new BadRequestException(
        'Title, description, price, category, and company are required',
      );
    }

    // Handle file uploads
    const uploadedPictures = await Promise.all(
      files.map(async (file) => {
        return await this.dbStorageService.saveFile(
          createServiceDto.company.toString(),
          file,
        );
      }),
    );

    // Add uploaded picture URLs to the DTO
    createServiceDto.pictures = uploadedPictures;

    return await this.serviceModel.create(createServiceDto);
  }

  async updateService(
    id: string,
    updateServiceDto: CreateServiceDto,
    files: Express.Multer.File[],
  ): Promise<Services> {
    const service = await this.serviceModel.findById(id);

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Handle file uploads
    const uploadedPictures = await Promise.all(
      files.map(async (file) => {
        return await this.dbStorageService.saveFile(
          updateServiceDto.company.toString(),
          file,
        );
      }),
    );

    // Add uploaded picture URLs to the DTO
    updateServiceDto.pictures = uploadedPictures;

    return await this.serviceModel.findByIdAndUpdate(id, updateServiceDto, {
      new: true,
    });
  }

  async deleteService(id: string): Promise<Services> {
    const service = await this.serviceModel.findById(id);

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return await this.serviceModel.findByIdAndDelete(id);
  }

  async getServices(): Promise<Services[]> {
    return await this.serviceModel.find().exec();
  }

  async getServiceById(id: string): Promise<Services> {
    return await this.serviceModel.findById(id);
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

  async getRandomServices(count: number): Promise<Services[]> {
    const sampleSize = Number(count); // Ensure count is converted to a number
    if (isNaN(sampleSize) || sampleSize <= 0) {
      throw new BadRequestException('Count must be a positive number');
    }

    return await this.serviceModel.aggregate([
      { $sample: { size: sampleSize } },
    ]);
  }
}
