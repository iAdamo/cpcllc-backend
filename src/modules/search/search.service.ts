import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import {
  Company,
  CompanyDocument,
} from 'src/modules/company/schemas/company.schema';
import {
  Service,
  Category,
  Subcategory,
  ServiceDocument,
  CategoryDocument,
  SubcategoryDocument,
} from '@modules/schemas/service.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  /**
   * Global search across companies and services with pagination and optional filters.
   * @param page - Page number for pagination (default 1).
   * @param limit - Number of results per page (default 10, max 100).
   * @param engine - Whether to use the search engine (true/false).
   * @param searchInput - Optional search input for text matching.
   * @param lat - Optional latitude for geo search.
   * @param long - Optional longitude for geo search.
   * @param address - Optional address for location-based search.
   * @return An object containing companies, services, total pages, and whether exact results were found.
   **/
  async globalSearch(
    page: string,
    limit: string,
    engine: string,
    searchInput?: string,
    lat?: string,
    long?: string,
    address?: string,
  ): Promise<{
    companies: Company[];
    services: Service[];
    totalPages: number;
    hasExactResults: boolean;
  }> {
    // Validate and parse inputs
    const pageN = Math.max(1, parseInt(page) || 1);
    const limitN = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const useEngine = engine === 'true';

    const searchCompanyConditions: any[] = [];
    const searchServiceConditions: any[] = [{ isActive: true }];

    // ===== ENGINE-ENABLED SEARCH =====
    if (useEngine) {
      // Geo search
      if (lat && long) {
        const coordinates = [parseFloat(long), parseFloat(lat)];
        const radiusInRadians = 1000 / 6378137;
        const geoWithin = {
          $geoWithin: { $centerSphere: [coordinates, radiusInRadians] },
        };

        searchCompanyConditions.push({
          $or: [
            { 'location.primary.coordinates': geoWithin },
            { 'location.secondary.coordinates': geoWithin },
            { 'location.tertiary.coordinates': geoWithin },
          ],
        });
      }

      // Address search
      if (address) {
        const addressRegex = new RegExp(address, 'i');
        searchCompanyConditions.push({
          $or: [
            { 'location.primary.address.address': addressRegex },
            { 'location.secondary.address.address': addressRegex },
            { 'location.tertiary.address.address': addressRegex },
          ],
        });
      }

      // Text search
      if (searchInput) {
        const searchRegex = new RegExp(searchInput, 'i');

        searchServiceConditions.push({
          $or: [
            { tags: searchRegex },
            { title: searchRegex },
            { description: searchRegex },
          ],
        });

        searchCompanyConditions.push({
          $or: [
            { companyName: searchRegex },
            { companyDescription: searchRegex },
            { 'subcategories.name': searchRegex },
            { 'companySocialMedia.facebook': searchRegex },
            { 'companySocialMedia.instagram': searchRegex },
            { 'companySocialMedia.twitter': searchRegex },
          ],
        });
      }
    }

    // ===== EXECUTE QUERIES =====
    let companyQuery: Company[] = [];
    let serviceQuery: Service[] = [];
    let totalCompanies = 0;
    let totalServices = 0;
    let hasExactResults = true;

    if (
      useEngine &&
      (searchCompanyConditions.length > 0 || searchServiceConditions.length > 1)
    ) {
      // Engine search with conditions
      [companyQuery, serviceQuery, totalCompanies, totalServices] =
        await Promise.all([
          this.companyModel
            .find(
              searchCompanyConditions.length
                ? { $and: searchCompanyConditions }
                : {},
            )
            .populate('subcategories')
            .sort({
              averageRating: -1,
              reviewCount: -1,
              favoriteCount: -1,
            })
            .skip((pageN - 1) * limitN)
            .limit(limitN)
            .exec(),

          this.serviceModel.aggregate([
            {
              $match: searchServiceConditions.length
                ? { $and: searchServiceConditions }
                : {},
            },
            {
              $lookup: {
                from: 'companies',
                localField: 'companyId',
                foreignField: '_id',
                as: 'company',
              },
            },
            { $unwind: '$company' },
            {
              $sort: {
                'company.averageRating': -1,
                'company.reviewCount': -1,
                price: 1,
              },
            },
            { $skip: (pageN - 1) * limitN },
            { $limit: limitN },
            {
              $project: {
                title: 1,
                description: 1,
                price: 1,
                duration: 1,
                tags: 1,
                'company.companyName': 1,
                'company.location': 1,
                'company.averageRating': 1,
                'company.reviewCount': 1,
              },
            },
          ]),

          this.companyModel.countDocuments(
            searchCompanyConditions.length
              ? { $and: searchCompanyConditions }
              : {},
          ),
          this.serviceModel.countDocuments(
            searchServiceConditions.length
              ? { $and: searchServiceConditions }
              : {},
          ),
        ]);
    } else {
      // FALLBACK: Return popular/trending results when no matches or engine disabled
      hasExactResults = false;

      [companyQuery, serviceQuery, totalCompanies, totalServices] =
        await Promise.all([
          this.companyModel
            .find()
            .populate('subcategories')
            .sort({
              averageRating: -1,
              reviewCount: -1,
              favoriteCount: -1,
              createdAt: -1,
            })
            .skip((pageN - 1) * limitN)
            .limit(limitN)
            .exec(),

          this.serviceModel.aggregate([
            { $match: { isActive: true } },
            {
              $lookup: {
                from: 'companies',
                localField: 'companyId',
                foreignField: '_id',
                as: 'company',
              },
            },
            { $unwind: '$company' },
            {
              $sort: {
                'company.averageRating': -1,
                'company.reviewCount': -1,
                createdAt: -1,
              },
            },
            { $skip: (pageN - 1) * limitN },
            { $limit: limitN },
            {
              $project: {
                title: 1,
                description: 1,
                price: 1,
                duration: 1,
                tags: 1,
                'company.companyName': 1,
                'company.location': 1,
                'company.averageRating': 1,
                'company.reviewCount': 1,
              },
            },
          ]),

          this.companyModel.countDocuments(),
          this.serviceModel.countDocuments({ isActive: true }),
        ]);
    }

    const totalPages = Math.ceil((totalCompanies + totalServices) / limitN);

    return {
      companies: companyQuery,
      services: serviceQuery,
      totalPages,
      hasExactResults,
    };
  }
}
