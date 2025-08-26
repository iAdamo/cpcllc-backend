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

  async getAllCategoriesWithSubcategories(): Promise<Category[]> {
    const categories = await this.categoryModel.find();
    const result = [];

    for (const cat of categories) {
      const subs = await this.subcategoryModel.find({ category: cat._id });
      result.push({
        id: cat._id,
        name: cat.name,
        description: cat.description,
        subcategories: subs.map((s) => ({
          id: s._id,
          name: s.name,
          description: s.description,
        })),
      });
    }

    return result;
  }

  async createService(
    serviceData: CreateServiceDto,
    userId: string,
    images?: Express.Multer.File[],
    videos?: Express.Multer.File[],
  ): Promise<ServiceDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const provider = await this.providerModel.findById(user.activeRoleId);
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    let imageLinks: string[] | null = null;
    let videoLinks: string[] = [];

    if (images && images.length > 0) {
      try {
        const uploadedImageLinks = await this.storage.handleFileUpload(
          `${userId}/services/images`,
          images,
        );
        imageLinks = uploadedImageLinks.map((item) => item.url);
      } catch (error) {
        throw new InternalServerErrorException('Error uploading images');
      }
    }

    if (videos && videos.length > 0) {
      try {
        const uploadedVideoLinks = await this.storage.handleFileUpload(
          `${userId}/services/videos`,
          videos,
        );
        videoLinks = uploadedVideoLinks.map((item) => item.url);
      } catch (error) {
        throw new InternalServerErrorException('Error uploading videos');
      }
    }

    const service = new this.serviceModel({
      ...serviceData,
      user: user._id,
      providerId: provider._id,
      images: imageLinks,
      videos: videoLinks,
    });

    return await service.save();
  }

  async updateService(
    serviceId: string,
    updateData: UpdateServiceDto,
    images?: Express.Multer.File[],
    videos?: Express.Multer.File[],
  ): Promise<ServiceDocument> {
    const service = await this.serviceModel.findById(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const provider = await this.providerModel.findById(service.providerId);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (images && images.length > 0) {
      try {
        const uploadedImageLinks = await this.storage.handleFileUpload(
          `${service.user}/services/images`,
          images,
        );
        updateData.images = uploadedImageLinks.map((item) => item.url);
      } catch (error) {
        throw new InternalServerErrorException('Error uploading images');
      }
    }

    if (videos && videos.length > 0) {
      try {
        const uploadedVideoLinks = await this.storage.handleFileUpload(
          `${service.user}/services/videos`,
          videos,
        );
        updateData.videos = uploadedVideoLinks.map((item) => item.url);
      } catch (error) {
        throw new InternalServerErrorException('Error uploading videos');
      }
    }
    const { providerId, user, ...safeUpdate } = updateData;
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
