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

  async createService(createServiceDto: CreateServiceDto): Promise<Services> {
    const { title, description, price, category, company } = createServiceDto;

    if (!title || !description || !price || !category || !company) {
      throw new BadRequestException(
        'Title, description, price, category, and company are required',
      );
    }

    return await this.serviceModel.create(createServiceDto);
  }
}
