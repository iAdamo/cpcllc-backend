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
} from '@schemas/service.schema';
import { JobPost, JobPostDocument } from '@schemas/job.schema';
import { Proposal, ProposalDocument } from '@schemas/proposal.schema';

interface SearchParams {
  page: string;
  limit: string;
  model: string;
  radius: string;
  engine: string;
  searchInput?: string;
  lat?: string;
  long?: string;
  address?: string;
  sortBy?: string[];
  categories?: string[];
}

interface SearchResult {
  providers?: Provider[];
  services?: Service[];
  jobs?: JobPost[];
  totalPages: number;
  page: number;
  hasExactResults: boolean;
}

interface PaginationConfig {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    @InjectModel(JobPost.name) private jobPostModel: Model<JobPostDocument>,
    @InjectModel(Proposal.name) private proposalModel: Model<ProposalDocument>,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  /**
   * Global search across providers, services, and jobs with pagination and filters
   */
  async globalSearch(params: SearchParams): Promise<SearchResult> {
    try {
      const { page, limit, model, engine } = params;
      const pagination = this.parsePaginationParams(page, limit);
      const useEngine = engine === 'true';

      switch (model) {
        case 'providers':
          return await this.searchProviders(params, pagination, useEngine);
        case 'jobs':
          return await this.searchJobs(params, pagination, useEngine);
        default:
          throw new BadRequestException(`Unsupported model type: ${model}`);
      }
    } catch (error) {
      console.error('Global search error:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Search failed',
      );
    }
  }

  private parsePaginationParams(page: string, limit: string): PaginationConfig {
    const pageN = Math.max(1, parseInt(page) || 1);
    const limitN = Math.min(100, Math.max(1, parseInt(limit) || 10));

    return {
      page: pageN,
      limit: limitN,
      skip: (pageN - 1) * limitN,
    };
  }

  private createGeoQuery(lat: string, long: string, radius: string) {
    const coordinates = [parseFloat(long), parseFloat(lat)];
    const radiusInRadians = Number(radius) || 1000 / 6378137;

    return {
      $geoWithin: { $centerSphere: [coordinates, radiusInRadians] },
    };
  }

  private createTextSearchRegex(searchInput: string): RegExp {
    return new RegExp(this.escapeRegex(searchInput), 'i');
  }

  private createPrefixRegex(searchInput: string): RegExp {
    // Matches strings that start with the input (progressive / prefix search), case-insensitive
    return new RegExp('^' + this.escapeRegex(searchInput), 'i');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Given an array of category or subcategory names, resolve to DB ObjectIds.
   * Returns lists of matching categoryIds and subcategoryIds.
   */
  private async resolveCategoryFilters(
    names: string[],
  ): Promise<{ categoryIds: any[]; subcategoryIds: any[] }> {
    // Normalize names (trim, case-insensitive match)
    const normalized = names
      .map((n) => (n || '').trim())
      .filter(Boolean)
      .map((n) => new RegExp('^' + this.escapeRegex(n) + '$', 'i'));

    if (!normalized.length) return { categoryIds: [], subcategoryIds: [] };

    const [categories, subcategories] = await Promise.all([
      this.categoryModel
        .find({ name: { $in: normalized } })
        .select('_id')
        .lean()
        .exec(),
      this.subcategoryModel
        .find({ name: { $in: normalized } })
        .select('_id')
        .lean()
        .exec(),
    ]);

    const categoryIds = categories.map((c: any) => c._id);
    const subcategoryIds = subcategories.map((s: any) => s._id);

    return { categoryIds, subcategoryIds };
  }

  private async searchProviders(
    params: SearchParams,
    pagination: PaginationConfig,
    useEngine: boolean,
  ): Promise<SearchResult> {
    const { searchInput, lat, long, address, sortBy, radius, categories } =
      params;
    const { skip, limit } = pagination;

    if (useEngine) {
      return this.searchProvidersWithEngine(
        { searchInput, lat, long, address, sortBy, radius, categories },
        pagination,
      );
    } else {
      return this.searchProvidersFallback(sortBy, pagination, categories);
    }
  }

  private async searchProvidersWithEngine(
    filters: {
      searchInput?: string;
      lat?: string;
      long?: string;
      address?: string;
      sortBy?: string[];
      radius?: string;
      categories?: string[];
    },
    pagination: PaginationConfig,
  ): Promise<SearchResult> {
    const { searchInput, lat, long, address, radius } = filters;
    const { skip, limit } = pagination;

    const providerConditions: any[] = [];
    const serviceConditions: any[] = [{ isActive: true }];

    // Geo search
    if (lat && long) {
      const geoQuery = this.createGeoQuery(lat, long, radius);
      providerConditions.push({
        $or: [
          { 'location.primary.coordinates': geoQuery },
          { 'location.secondary.coordinates': geoQuery },
          { 'location.tertiary.coordinates': geoQuery },
        ],
      });
    }

    // Address search (progressive / prefix matching across multiple address sub-fields)
    if (address) {
      const prefixRegex = this.createPrefixRegex(address);
      const addressOrs = [
        { 'location.primary.address.zip': prefixRegex },
        { 'location.primary.address.city': prefixRegex },
        { 'location.primary.address.state': prefixRegex },
        { 'location.primary.address.country': prefixRegex },
        { 'location.primary.address.address': prefixRegex },
        { 'location.secondary.address.zip': prefixRegex },
        { 'location.secondary.address.city': prefixRegex },
        { 'location.secondary.address.state': prefixRegex },
        { 'location.secondary.address.country': prefixRegex },
        { 'location.secondary.address.address': prefixRegex },
        { 'location.tertiary.address.zip': prefixRegex },
        { 'location.tertiary.address.city': prefixRegex },
        { 'location.tertiary.address.state': prefixRegex },
        { 'location.tertiary.address.country': prefixRegex },
        { 'location.tertiary.address.address': prefixRegex },
      ];

      providerConditions.push({ $or: addressOrs });
    }

    // Text search
    if (searchInput) {
      const searchRegex = this.createTextSearchRegex(searchInput);

      serviceConditions.push({
        $or: [
          { tags: searchRegex },
          { title: searchRegex },
          { description: searchRegex },
        ],
      });

      providerConditions.push({
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

    // Category filters (categories may be category names or subcategory names)
    if (filters.categories && filters.categories.length) {
      const { categoryIds, subcategoryIds } = await this.resolveCategoryFilters(
        filters.categories,
      );

      const categoryOrs: any[] = [];
      if (categoryIds.length)
        categoryOrs.push({ categories: { $in: categoryIds } });
      if (subcategoryIds.length)
        categoryOrs.push({ subcategories: { $in: subcategoryIds } });

      if (categoryOrs.length) {
        providerConditions.push({ $or: categoryOrs });
      }

      if (subcategoryIds.length) {
        serviceConditions.push({ subcategoryId: { $in: subcategoryIds } });
      }
    }

    const [providers, services, totalCompanies, totalServices] =
      await Promise.all([
        this.executeProviderQuery(providerConditions, skip, limit),
        this.executeServiceQuery(serviceConditions, skip, limit),
        this.providerModel.countDocuments(
          providerConditions.length ? { $and: providerConditions } : {},
        ),
        this.serviceModel.countDocuments(
          serviceConditions.length ? { $and: serviceConditions } : {},
        ),
      ]);

    const totalPages = Math.ceil((totalCompanies + totalServices) / limit);

    return {
      providers,
      services,
      totalPages,
      page: pagination.page,
      hasExactResults: true,
    };
  }

  private async searchProvidersFallback(
    sortBy: string[] = [],
    pagination: PaginationConfig,
    categories?: string[],
  ): Promise<SearchResult> {
    const { skip, limit } = pagination;

    const providerSort = this.getProviderSortCriteria(sortBy);
    const serviceSort = this.getServiceSortCriteria(sortBy);

    // Apply category filters if provided
    let providerConditions: any[] = [];
    let serviceConditions: any[] = [{ isActive: true }];

    if (categories && categories.length) {
      const { categoryIds, subcategoryIds } =
        await this.resolveCategoryFilters(categories);

      if (categoryIds.length)
        providerConditions.push({ categories: { $in: categoryIds } });
      if (subcategoryIds.length) {
        providerConditions.push({ subcategories: { $in: subcategoryIds } });
        serviceConditions.push({ subcategoryId: { $in: subcategoryIds } });
      }
    }

    const [providers, services, totalCompanies, totalServices] =
      await Promise.all([
        this.executeProviderQuery(
          providerConditions,
          skip,
          limit,
          providerSort,
        ),
        this.executeServiceQuery(serviceConditions, skip, limit, serviceSort),
        this.providerModel.countDocuments(
          providerConditions.length ? { $and: providerConditions } : {},
        ),
        this.serviceModel.countDocuments(
          serviceConditions.length ? { $and: serviceConditions } : {},
        ),
      ]);

    const totalPages = Math.ceil((totalCompanies + totalServices) / limit);

    return {
      providers,
      services,
      totalPages,
      page: pagination.page,
      hasExactResults: false,
    };
  }

  private async executeProviderQuery(
    conditions: any[],
    skip: number,
    limit: number,
    sort: any = { averageRating: -1, reviewCount: -1, favoriteCount: -1 },
  ): Promise<Provider[]> {
    const query = conditions.length ? { $and: conditions } : {};

    return this.providerModel
      .find(query)
      .populate({
        path: 'subcategories',
        model: 'Subcategory',
        select: 'name description',
      })
      .populate({
        path: 'followedBy',
        model: 'User',
        select: 'profilePic firstName lastName email',
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();
  }

  private async executeServiceQuery(
    conditions: any[],
    skip: number,
    limit: number,
    sort: any = { 'provider.averageRating': -1, 'provider.reviewCount': -1 },
  ): Promise<Service[]> {
    const matchStage = conditions.length
      ? { $match: { $and: conditions } }
      : { $match: {} };

    return this.serviceModel.aggregate([
      matchStage,
      {
        $lookup: {
          from: 'providers',
          localField: 'providerId',
          foreignField: '_id',
          as: 'provider',
        },
      },
      { $unwind: '$provider' },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
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
    ]);
  }

  private async searchJobs(
    params: SearchParams,
    pagination: PaginationConfig,
    useEngine: boolean,
  ): Promise<SearchResult> {
    const { searchInput, lat, long, sortBy, radius, address } = params;
    const { skip, limit } = pagination;

    // Only return jobs that are marked active in both flags: isActive and status === 'active'
    const conditions: any[] = [{ isActive: true }, { status: 'Active' }];

    if (useEngine && searchInput) {
      const searchRegex = this.createTextSearchRegex(searchInput);
      conditions.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: searchRegex },
          { location: searchRegex },
        ],
      });
    }

    // If an address filter was provided, do progressive/prefix matching on the job.location string
    if (address) {
      const prefix = this.createPrefixRegex(address);
      conditions.push({ location: prefix });
    }

    if (!useEngine && lat && long && sortBy?.includes('Distance')) {
      const geoQuery = this.createGeoQuery(lat, long, radius);
      conditions.push({ coordinates: geoQuery });
    }

    const sortCriteria = this.getJobSortCriteria(sortBy, lat, long);

    const [jobs, totalJobs] = await Promise.all([
      this.jobPostModel
        .find(conditions.length ? { $and: conditions } : {})
        .populate({
          path: 'userId',
          model: 'User',
        })
        .populate({
          path: 'proposals',
          model: 'Proposal',
          populate: {
            path: 'providerId',
            model: 'Provider',
            select: 'providerName providerLogo isVerified',
          },
        })
        .populate({
          path: 'subcategoryId',
          model: 'Subcategory',
          select: '_id name description',
          populate: {
            path: 'categoryId',
            model: 'Category',
            select: '_id name description',
          },
        })
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.jobPostModel.countDocuments(
        conditions.length ? { $and: conditions } : {},
      ),
    ]);

    const totalPages = Math.ceil(totalJobs / limit);

    return {
      jobs,
      totalPages,
      page: pagination.page,
      hasExactResults: useEngine,
    };
  }

  private getProviderSortCriteria(sortBy: string[] = []): any {
    const sortMap: { [key: string]: any } = {
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      default: { averageRating: -1, reviewCount: -1, favoriteCount: -1 },
    };

    return sortMap[sortBy[0]] || sortMap.default;
  }

  private getServiceSortCriteria(sortBy: string[] = []): any {
    const sortMap: { [key: string]: any } = {
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      default: { 'provider.averageRating': -1, 'provider.reviewCount': -1 },
    };

    return sortMap[sortBy[0]] || sortMap.default;
  }

  private getJobSortCriteria(
    sortBy: string[] = [],
    lat?: string,
    long?: string,
  ): any {
    const sortMap: { [key: string]: any } = {
      Deadline: { deadline: 1, createdAt: -1 },
      Distance:
        lat && long ? { coordinates: 1, createdAt: -1 } : { createdAt: -1 },
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      default: { createdAt: -1 },
    };

    return sortMap[sortBy[0]] || sortMap.default;
  }
}
