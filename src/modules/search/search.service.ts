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
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
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
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
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
   * @param sortBy - Optional sorting criteria (e.g., 'rating', 'popularity').
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
    sortBy?: string,
  ): Promise<{
    companies: Provider[];
    services: Service[];
    totalPages: number;
    hasExactResults: boolean;
  }> {
    // Validate and parse inputs
    const pageN = Math.max(1, parseInt(page) || 1);
    const limitN = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const useEngine = engine === 'true';

    const searchProviderConditions: any[] = [];
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

        searchProviderConditions.push({
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
        searchProviderConditions.push({
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

        searchProviderConditions.push({
          $or: [
            { providerName: searchRegex },
            { providerDescription: searchRegex },
            { 'subcategories.name': searchRegex },
            { 'providerSocialMedia.facebook': searchRegex },
            { 'providerSocialMedia.instagram': searchRegex },
            { 'providerSocialMedia.twitter': searchRegex },
          ],
        });
      }
    }

    // ===== EXECUTE QUERIES =====
    let providerQuery: Provider[] = [];
    let serviceQuery: Service[] = [];
    let totalCompanies = 0;
    let totalServices = 0;
    let hasExactResults = true;

    if (
      useEngine &&
      (searchProviderConditions.length > 0 ||
        searchServiceConditions.length > 1)
    ) {
      // Engine search with conditions
      [providerQuery, serviceQuery, totalCompanies, totalServices] =
        await Promise.all([
          this.providerModel
            .find(
              searchProviderConditions.length
                ? { $and: searchProviderConditions }
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
                localField: 'providerId',
                foreignField: '_id',
                as: 'provider',
              },
            },
            { $unwind: '$provider' },
            {
              $sort: {
                'provider.averageRating': -1,
                'provider.reviewCount': -1,
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
                'provider.providerName': 1,
                'provider.location': 1,
                'provider.averageRating': 1,
                'provider.reviewCount': 1,
              },
            },
          ]),

          this.providerModel.countDocuments(
            searchProviderConditions.length
              ? { $and: searchProviderConditions }
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

      [providerQuery, serviceQuery, totalCompanies, totalServices] =
        await Promise.all([
          this.providerModel
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
                localField: 'providerId',
                foreignField: '_id',
                as: 'provider',
              },
            },
            { $unwind: '$provider' },
            {
              $sort: {
                'provider.averageRating': -1,
                'provider.reviewCount': -1,
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
                'provider.providerName': 1,
                'provider.location': 1,
                'provider.averageRating': 1,
                'provider.reviewCount': 1,
              },
            },
          ]),

          this.providerModel.countDocuments(),
          this.serviceModel.countDocuments({ isActive: true }),
        ]);
    }

    const totalPages = Math.ceil((totalCompanies + totalServices) / limitN);

    return {
      companies: providerQuery,
      services: serviceQuery,
      totalPages,
      hasExactResults,
    };
  }
}
