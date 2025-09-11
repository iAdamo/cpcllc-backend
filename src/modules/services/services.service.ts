import {
  CreateCategoryDto,
  CreateSubcategoryDto,
} from '@modules/dto/create-service.dto';
import { CreateServiceDto } from '@modules/dto/create-service.dto';
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
import {
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
import {
  Subcategory,
  SubcategoryDocument,
  Category,
  CategoryDocument,
  Service,
  ServiceDocument,
} from '@modules/schemas/service.schema';
import { UpdateServiceDto } from '@modules/dto/update-service.dto';
import { DbStorageService } from 'src/utils/dbStorage';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
  ) {}

  private readonly storage = new DbStorageService();

  // Admin
  async createCategory(
    categoryData: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    const existingCategory = await this.categoryModel.findOne({
      name: categoryData.name,
    });

    if (existingCategory) {
      throw new ConflictException('Category already exists');
    }

    const category = new this.categoryModel(categoryData);
    return await category.save();
  }
  // Admin

  async createSubcategory(
    subcategoryData: CreateSubcategoryDto,
  ): Promise<SubcategoryDocument> {
    const existingSubcategory = await this.subcategoryModel.findOne({
      name: subcategoryData.name,
      category: subcategoryData.category,
    });

    if (existingSubcategory) {
      throw new ConflictException('Subcategory already exists');
    }

    const subcategory = new this.subcategoryModel(subcategoryData);
    return await subcategory.save();
  }
  // Admin

   async getAllCategoriesWithSubcategories(): Promise<Category[]> {
    return this.categoryModel
      .find()
      .populate({
        path: 'subcategories',
        model: 'Subcategory',
        select: 'name description', // add more fields if needed

      })
      .sort({ createdAt: 1 })
      .exec();
  }

  async getSubcategoryById(id: string): Promise<Subcategory> {
    return this.subcategoryModel.findById(id).populate('categoryId').exec();
  }

  async createService(
    serviceData: CreateServiceDto,
    userId: string,
    files: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    },
  ): Promise<ServiceDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const provider = await this.providerModel.findById(user.activeRoleId);
    if (!provider) {
      throw new NotFoundException('You are not a provider yet!');
    }

    const fileUrls = await this.storage.handleFileUploads(
      `${user._id}/services/images`,
      files,
    );

    const service = new this.serviceModel({
      ...serviceData,
      userId: user._id,
      providerId: provider._id,
      ...fileUrls,
    });

    return await service.save();
  }

  async updateService(
    serviceId: string,
    updateData: UpdateServiceDto,
    files: {
      images?: Express.Multer.File[];
      videos?: Express.Multer.File[];
    },
  ): Promise<ServiceDocument> {
    const service = await this.serviceModel.findById(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const provider = await this.providerModel.findById(service.providerId);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (provider._id.toString() !== service.providerId.toString()) {
      throw new BadRequestException(
        'You can only update services of your own provider account',
      );
    }

    const fileUrls = await this.storage.handleFileUploads(
      `${service.userId}/services/images`,
      files,
    );

    const updateDataWithFiles = { ...updateData, ...fileUrls };
    // Remove providerId and user from update data to prevent changes
    const { providerId, userId, ...safeUpdate } = updateDataWithFiles;
    return await this.serviceModel.findByIdAndUpdate(serviceId, safeUpdate, {
      new: true,
    });
  }

  async deleteService(serviceId: string): Promise<ServiceDocument> {
    const service = await this.serviceModel.findByIdAndDelete(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async getServicesByProvider(providerId: string): Promise<Service[]> {
    try {
      const provider = await this.providerModel.findById(providerId);
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const services = await this.serviceModel
        .find({ providerId: provider._id })
        .populate('providerId', 'providerName providerImages');

      return services;
    } catch (error) {
      console.error(error);
    }
  }

  async getServiceById(serviceId: string): Promise<ServiceDocument> {
    const service = await this.serviceModel
      .findById(serviceId)
      .populate('providerId', 'providerName providerImages');

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }
}
