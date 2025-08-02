import {
  CreateCategoryDto,
  CreateSubcategoryDto,
} from '@dto/create-service.dto';
import { CreateServiceDto } from '@dto/create-service.dto';
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
import { Reviews, ReviewsDocument } from '@schemas/reviews.schema';
import {
  Subcategory,
  SubcategoryDocument,
  Category,
  CategoryDocument,
  Service,
  ServiceDocument,
} from '@schemas/service.schema';
import { handleFileUpload } from 'src/utils/fileUpload';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Reviews.name) private reviewsModel: Model<ReviewsDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
  ) {}

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
    console.log('Creating service with data:', serviceData);
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const company = await this.companyModel.findById(user.activeRoleId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let imageLinks: string[] | null = null;
    let videoLinks: string[] = [];

    if (images && images.length > 0) {
      try {
        const uploadedImageLinks = await handleFileUpload(
          `services/${company.companyName.toLowerCase()}/images`,
          images,
        );
        imageLinks = uploadedImageLinks.map((item) => item.url);
      } catch (error) {
        throw new InternalServerErrorException('Error uploading images');
      }
    }

    if (videos && videos.length > 0) {
      try {
        const uploadedVideoLinks = await handleFileUpload(
          `services/${company.companyName.toLowerCase()}/videos`,
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
      company: company._id,
      images: imageLinks,
      videos: videoLinks,
    });

    return await service.save();
  }

  async getServicesByCompany(companyId: string): Promise<Service[]> {
    const company = await this.companyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const services = await this.serviceModel
      .find({ company: company._id })
      .populate('company', 'companyName companyImages');

    return services;
  }
}
