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
import {
  SearchParams,
  SearchResult,
  MediaAdItem,
  MediaFeedItem,
  MediaFeedResponse,
  PaginationConfig,
} from 'src/types/search';

export interface LocationFilter {
  country?: string;
  state?: string;
  featured?: boolean;
  lat?: string;
  long?: string;
  radius?: string;
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
   * Global search with location hierarchy as default
   */
  async globalSearch(params: SearchParams): Promise<SearchResult> {
    try {
      const { page, limit, model, engine, featured } = params;
      const pagination = this.parsePaginationParams(page, limit);
      const useEngine = engine === 'true';

      switch (model) {
        case 'providers':
          // Always use location-based search for providers
          if (featured === 'true') {
            const { providers, featuredRatio } =
              await this.searchProvidersWithPromotion(params, pagination);
            const totalProviders = await this.getTotalProvidersCount(params);
            const totalPages = Math.ceil(totalProviders / pagination.limit);

            return {
              providers,
              services: [],
              totalPages,
              page: pagination.page,
              hasExactResults: true,
              featuredRatio,
            };
          } else {
            return await this.searchProviders(params, pagination, useEngine);
          }
        case 'jobs':
          // Always use location-based search for jobs
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

  /**
   * Enhanced provider search with location hierarchy as default
   */
  private async searchProviders(
    params: SearchParams,
    pagination: PaginationConfig,
    useEngine: boolean,
  ): Promise<SearchResult> {
    const {
      searchInput,
      lat,
      long,
      address,
      sortBy,
      radius,
      categories,
      state,
      country,
    } = params;
    const { skip, limit } = pagination;

    if (useEngine) {
      return this.searchProvidersWithEngine(
        {
          searchInput,
          lat,
          long,
          address,
          sortBy,
          radius,
          categories,
          state,
          country,
        },
        pagination,
      );
    } else {
      return this.searchProvidersFallback(params, pagination);
    }
  }

  /**
   * Enhanced provider search with location hierarchy
   */
  private async searchProvidersWithEngine(
    filters: {
      searchInput?: string;
      lat?: string;
      long?: string;
      address?: string;
      sortBy?: string[];
      radius?: string;
      categories?: string[];
      state?: string;
      country?: string;
    },
    pagination: PaginationConfig,
  ): Promise<SearchResult> {
    const { searchInput, lat, long, address, radius, state, country } = filters;
    const { skip, limit } = pagination;

    // Build location conditions using hierarchy
    const locationConditions = await this.buildHierarchicalLocationConditions(
      { lat, long, radius, state, country },
      'provider',
    );

    const providerConditions: any[] = [...locationConditions];
    const serviceConditions: any[] = [{ isActive: true }];

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

  /**
   * Fallback provider search with location hierarchy
   */
  private async searchProvidersFallback(
    params: SearchParams,
    pagination: PaginationConfig,
  ): Promise<SearchResult> {
    const {
      searchInput,
      sortBy,
      categories,
      lat,
      long,
      radius,
      state,
      country,
    } = params;
    const { skip, limit } = pagination;

    const providerSort = this.getProviderSortCriteria(sortBy);
    const serviceSort = this.getServiceSortCriteria(sortBy);

    // Build location conditions using hierarchy
    const locationConditions = await this.buildHierarchicalLocationConditions(
      { lat, long, radius, state, country },
      'provider',
    );

    // Apply category filters if provided
    let providerConditions: any[] = [...locationConditions];
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

  /**
   * Enhanced job search with location hierarchy as default
   */
  private async searchJobs(
    params: SearchParams,
    pagination: PaginationConfig,
    useEngine: boolean,
  ): Promise<SearchResult> {
    const { searchInput, lat, long, sortBy, radius, address, state, country } =
      params;
    const { skip, limit } = pagination;

    // Build location conditions using hierarchy
    const locationConditions = await this.buildHierarchicalLocationConditions(
      { lat, long, radius, state, country },
      'job',
    );

    // Only return jobs that are marked active in both flags: isActive and status === 'active'
    const conditions: any[] = [
      { isActive: true },
      { status: 'Active' },
      ...locationConditions,
    ];

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

  /**
   * Build hierarchical location conditions (coordinates → state → country)
   */
  private async buildHierarchicalLocationConditions(
    filters: {
      lat?: string;
      long?: string;
      radius?: string;
      state?: string;
      country?: string;
    },
    type: 'provider' | 'job',
  ): Promise<any[]> {
    const { lat, long, radius, state, country } = filters;
    const conditions: any[] = [];

    // If no location parameters provided, return empty conditions (search everything)
    if (!lat && !long && !state && !country) {
      return conditions;
    }

    // Try coordinates first
    if (lat && long) {
      if (type === 'provider') {
        const geoQuery = this.createGeoQuery(lat, long, radius);
        conditions.push({
          $or: [
            { 'location.primary.coordinates': geoQuery },
            { 'location.secondary.coordinates': geoQuery },
            { 'location.tertiary.coordinates': geoQuery },
          ],
        });
      } else if (type === 'job') {
        const geoQuery = this.createGeoQuery(lat, long, radius);
        conditions.push({ coordinates: geoQuery });
      }

      // If coordinates are provided, we use them exclusively
      return conditions;
    }

    // If no coordinates but state is provided
    if (state) {
      const stateRegex = new RegExp(this.escapeRegex(state.trim()), 'i');

      if (type === 'provider') {
        conditions.push({
          $or: [
            { 'location.primary.address.state': stateRegex },
            { 'location.secondary.address.state': stateRegex },
            { 'location.tertiary.address.state': stateRegex },
          ],
        });
      } else if (type === 'job') {
        conditions.push({ location: stateRegex });
      }

      // If state is provided, we use it exclusively (unless coordinates were provided)
      return conditions;
    }

    // If only country is provided
    if (country) {
      const countryRegex = new RegExp(this.escapeRegex(country.trim()), 'i');

      if (type === 'provider') {
        conditions.push({
          $or: [
            { 'location.primary.address.country': countryRegex },
            { 'location.secondary.address.country': countryRegex },
            { 'location.tertiary.address.country': countryRegex },
          ],
        });
      } else if (type === 'job') {
        conditions.push({ location: countryRegex });
      }
    }

    return conditions;
  }

  /**
   * Enhanced provider search with featured provider promotion
   * Returns mixed results with 70% featured and 30% non-featured when featured=true
   */
  async searchProvidersWithPromotion(
    params: SearchParams,
    pagination: PaginationConfig,
  ): Promise<{ providers: Provider[]; featuredRatio: number }> {
    const { featured, state, country, lat, long, radius } = params;
    const { skip, limit } = pagination;

    // If featured is not requested, use normal location-based search
    if (!featured || featured !== 'true') {
      const providers = await this.getProvidersByLocationHierarchy(
        { lat, long, radius, state, country, featured: false },
        pagination,
      );
      return { providers, featuredRatio: 0 };
    }

    // Calculate split for 70/30 ratio
    const totalLimit = limit;
    const featuredLimit = Math.ceil(totalLimit * 0.7);
    const nonFeaturedLimit = totalLimit - featuredLimit;

    // Build location queries using hierarchy
    const locationConditions = await this.buildHierarchicalLocationConditions(
      { lat, long, radius, state, country },
      'provider',
    );

    let featuredProviders: Provider[] = [];
    let nonFeaturedProviders: Provider[] = [];

    // Search in hierarchy for featured providers first
    const baseQuery = locationConditions.length
      ? { $and: locationConditions }
      : {};

    if (featuredProviders.length < featuredLimit) {
      const featuredQuery = { ...baseQuery, isFeatured: true };

      const additionalFeatured = await this.providerModel
        .find(featuredQuery)
        .populate({
          path: 'subcategories',
          model: 'Subcategory',
          select: 'name description',
        })
        .sort({ averageRating: -1, reviewCount: -1 })
        .skip(skip)
        .limit(featuredLimit - featuredProviders.length)
        .exec();

      featuredProviders = [...featuredProviders, ...additionalFeatured];
    }

    if (nonFeaturedProviders.length < nonFeaturedLimit) {
      const nonFeaturedQuery = { ...baseQuery, isFeatured: false };

      const additionalNonFeatured = await this.providerModel
        .find(nonFeaturedQuery)
        .populate({
          path: 'subcategories',
          model: 'Subcategory',
          select: 'name description',
        })
        .sort({ averageRating: -1, reviewCount: -1 })
        .skip(skip)
        .limit(nonFeaturedLimit - nonFeaturedProviders.length)
        .exec();

      nonFeaturedProviders = [
        ...nonFeaturedProviders,
        ...additionalNonFeatured,
      ];
    }

    // Combine results maintaining the ratio
    const providers = [...featuredProviders, ...nonFeaturedProviders];
    const featuredRatio =
      providers.length > 0 ? featuredProviders.length / providers.length : 0;

    return { providers, featuredRatio };
  }

  /**
   * Get providers by location hierarchy
   */
  private async getProvidersByLocationHierarchy(
    locationFilter: LocationFilter,
    pagination: PaginationConfig,
  ): Promise<Provider[]> {
    const { lat, long, radius, state, country, featured } = locationFilter;
    const { skip, limit } = pagination;

    // Build location conditions using hierarchy
    const locationConditions = await this.buildHierarchicalLocationConditions(
      { lat, long, radius, state, country },
      'provider',
    );

    // Build base query
    const queryConditions: any[] = [...locationConditions];
    if (featured !== undefined) {
      queryConditions.push({ isFeatured: featured });
    }

    const baseQuery = queryConditions.length ? { $and: queryConditions } : {};

    return this.providerModel
      .find(baseQuery)
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
      .sort(this.getProviderSortCriteria([], featured))
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Get total provider count for pagination
   */
  private async getTotalProvidersCount(params: SearchParams): Promise<number> {
    const { lat, long, radius, state, country, featured } = params;

    // Build location conditions using hierarchy
    const locationConditions = await this.buildHierarchicalLocationConditions(
      { lat, long, radius, state, country },
      'provider',
    );

    const queryConditions: any[] = [...locationConditions];
    if (featured === 'true') {
      queryConditions.push({ isFeatured: true });
    }

    const baseQuery = queryConditions.length ? { $and: queryConditions } : {};
    return await this.providerModel.countDocuments(baseQuery);
  }

  /**
   * Enhanced sort criteria to promote featured providers
   */
  private getProviderSortCriteria(
    sortBy: string[] = [],
    featured?: boolean,
  ): any {
    const sortMap: { [key: string]: any } = {
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      default: { averageRating: -1, reviewCount: -1, favoriteCount: -1 },
    };

    const baseSort = sortMap[sortBy?.[0]] || sortMap.default;

    // If featured sorting is requested, promote featured providers
    if (featured) {
      return { isFeatured: -1, ...baseSort };
    }

    return baseSort;
  }

  // Helper methods (keep existing implementations)

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
    const meters = Number(radius) || 10000; // Default 10km radius for broader search
    const radiusInRadians = meters / 6378137;

    return {
      $geoWithin: { $centerSphere: [coordinates, radiusInRadians] },
    };
  }

  private createTextSearchRegex(searchInput: string): RegExp {
    return new RegExp(this.escapeRegex(searchInput), 'i');
  }

  private createPrefixRegex(searchInput: string): RegExp {
    return new RegExp('^' + this.escapeRegex(searchInput), 'i');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async resolveCategoryFilters(
    names: string[],
  ): Promise<{ categoryIds: any[]; subcategoryIds: any[] }> {
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

  private getServiceSortCriteria(sortBy: string[] = []): any {
    const sortMap: { [key: string]: any } = {
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      default: { 'provider.averageRating': -1, 'provider.reviewCount': -1 },
    };

    return sortMap[sortBy?.[0]] || sortMap.default;
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

    return sortMap[sortBy?.[0]] || sortMap.default;
  }
}
