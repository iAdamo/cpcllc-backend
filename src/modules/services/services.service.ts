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

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Services.name) private serviceModel: Model<Services>,
  ) {}

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
