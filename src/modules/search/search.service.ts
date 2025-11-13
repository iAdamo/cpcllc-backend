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
  subcategories?: string[];
  minPrice?: string;
  maxPrice?: string;
  urgency?: string;
  status?: string;
}

interface SearchResult {
  providers?: Provider[];
  services?: Service[];
  jobs?: JobPost[];
  categories?: Category[];
  subcategories?: Subcategory[];
  totalPages: number;
  page: number;
  hasExactResults: boolean;
  searchSuggestions?: string[];
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
   * Global search across providers, services, and jobs with progressive search capabilities
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
        case 'services':
          return await this.searchServices(params, pagination, useEngine);
        case 'categories':
          return await this.searchCategories(params, pagination, useEngine);
        default:
          // Combined search across all models when engine is true
          if (useEngine) {
            return await this.combinedSearch(params, pagination);
          }
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
    const radiusInMeters = Number(radius) || 10000; // Default 10km
    const radiusInRadians = radiusInMeters / 6378137; // Earth's radius in meters

    return {
      $geoWithin: { $centerSphere: [coordinates, radiusInRadians] },
    };
  }

  private createTextSearchRegex(searchInput: string): RegExp {
    // More flexible regex that matches words in any order
    const words = searchInput.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) return new RegExp('.*', 'i');

    const regexPattern =
      words.map((word) => `(?=.*${this.escapeRegex(word)})`).join('') + '.*';
    return new RegExp(regexPattern, 'i');
  }

  private createPrefixRegex(searchInput: string): RegExp {
    // Matches strings that start with the input (progressive / prefix search), case-insensitive
    return new RegExp('^' + this.escapeRegex(searchInput), 'i');
  }

  private createFuzzyRegex(searchInput: string): RegExp {
    // Creates a fuzzy search pattern for more flexible matching
    const fuzzyPattern = searchInput
      .split('')
      .map((char) => `${this.escapeRegex(char)}.*`)
      .join('');
    return new RegExp(fuzzyPattern, 'i');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Enhanced category resolution with progressive name matching
   */
  private async resolveCategoryFilters(
    names: string[],
    useEngine: boolean = false,
  ): Promise<{
    categoryIds: Types.ObjectId[];
    subcategoryIds: Types.ObjectId[];
  }> {
    if (!names || names.length === 0) {
      return { categoryIds: [], subcategoryIds: [] };
    }

    const normalized = names.map((n) => (n || '').trim()).filter(Boolean);

    if (useEngine) {
      // For engine search, use progressive matching
      const categoryRegex = new RegExp(normalized.join('|'), 'i');
      const subcategoryRegex = new RegExp(normalized.join('|'), 'i');

      const [categories, subcategories] = await Promise.all([
        this.categoryModel
          .find({ name: categoryRegex })
          .select('_id')
          .lean()
          .exec(),
        this.subcategoryModel
          .find({ name: subcategoryRegex })
          .select('_id')
          .lean()
          .exec(),
      ]);

      return {
        categoryIds: categories.map((c: any) => c._id),
        subcategoryIds: subcategories.map((s: any) => s._id),
      };
    } else {
      // For exact matching in non-engine mode
      const exactRegexes = normalized.map(
        (n) => new RegExp('^' + this.escapeRegex(n) + '$', 'i'),
      );

      const [categories, subcategories] = await Promise.all([
        this.categoryModel
          .find({ name: { $in: exactRegexes } })
          .select('_id')
          .lean()
          .exec(),
        this.subcategoryModel
          .find({ name: { $in: exactRegexes } })
          .select('_id')
          .lean()
          .exec(),
      ]);

      return {
        categoryIds: categories.map((c: any) => c._id),
        subcategoryIds: subcategories.map((s: any) => s._id),
      };
    }
  }

  /**
   * Combined search across all models when engine is true
   */
  private async combinedSearch(
    params: SearchParams,
    pagination: PaginationConfig,
  ): Promise<SearchResult> {
    const { searchInput } = params;

    if (!searchInput) {
      throw new BadRequestException(
        'Search input is required for combined search',
      );
    }

    const [providersResult, servicesResult, jobsResult, categoriesResult] =
      await Promise.all([
        this.searchProviders(
          { ...params, model: 'providers' },
          pagination,
          true,
        ),
        this.searchServices({ ...params, model: 'services' }, pagination, true),
        this.searchJobs({ ...params, model: 'jobs' }, pagination, true),
        this.searchCategories(
          { ...params, model: 'categories' },
          pagination,
          true,
        ),
      ]);

    // Generate search suggestions based on the input
    const searchSuggestions = await this.generateSearchSuggestions(searchInput);

    return {
      providers: providersResult.providers,
      services: servicesResult.services,
      jobs: jobsResult.jobs,
      categories: categoriesResult.categories,
      totalPages: Math.max(
        providersResult.totalPages || 0,
        servicesResult.totalPages || 0,
        jobsResult.totalPages || 0,
        categoriesResult.totalPages || 0,
      ),
      page: pagination.page,
      hasExactResults: true,
      searchSuggestions,
    };
  }

  /**
   * Generate search suggestions based on user input
   */
  private async generateSearchSuggestions(
    searchInput: string,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (searchInput.length < 2) return suggestions;

    const searchRegex = this.createPrefixRegex(searchInput);

    try {
      // Get category suggestions
      const categorySuggestions = await this.categoryModel
        .find({ name: searchRegex })
        .select('name')
        .limit(5)
        .exec();

      // Get subcategory suggestions
      const subcategorySuggestions = await this.subcategoryModel
        .find({ name: searchRegex })
        .select('name')
        .limit(5)
        .exec();

      // Get provider name suggestions
      const providerSuggestions = await this.providerModel
        .find({ providerName: searchRegex })
        .select('providerName')
        .limit(5)
        .exec();

      // Get service title suggestions
      const serviceSuggestions = await this.serviceModel
        .find({ title: searchRegex, isActive: true })
        .select('title')
        .limit(5)
        .exec();

      suggestions.push(
        ...categorySuggestions.map((c) => c.name),
        ...subcategorySuggestions.map((s) => s.name),
        ...providerSuggestions.map((p) => p.providerName),
        ...serviceSuggestions.map((s) => s.title),
      );

      // Remove duplicates and return top 10
      return [...new Set(suggestions)].slice(0, 10);
    } catch (error) {
      console.error('Error generating search suggestions:', error);
      return [];
    }
  }

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
      subcategories,
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
          subcategories,
        },
        pagination,
      );
    } else {
      return this.searchProvidersFallback(
        sortBy,
        pagination,
        categories,
        subcategories,
      );
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
      subcategories?: string[];
    },
    pagination: PaginationConfig,
  ): Promise<SearchResult> {
    const {
      searchInput,
      lat,
      long,
      address,
      radius,
      categories,
      subcategories,
    } = filters;
    const { skip, limit } = pagination;

    const providerConditions: any[] = [];
    const serviceConditions: any[] = [{ isActive: true }];

    // PRIORITIZE COORDINATES OVER ADDRESS when both are present
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
    // Fallback to address search if no coordinates
    else if (address) {
      const prefixRegex = this.createPrefixRegex(address);
      const addressOrs = [
        { 'location.primary.address.address': prefixRegex },
        { 'location.primary.address.city': prefixRegex },
        { 'location.primary.address.state': prefixRegex },
        { 'location.primary.address.country': prefixRegex },
        { 'location.primary.address.zip': prefixRegex },
        { 'location.secondary.address.address': prefixRegex },
        { 'location.secondary.address.city': prefixRegex },
        { 'location.secondary.address.state': prefixRegex },
        { 'location.secondary.address.country': prefixRegex },
        { 'location.secondary.address.zip': prefixRegex },
        { 'location.tertiary.address.address': prefixRegex },
        { 'location.tertiary.address.city': prefixRegex },
        { 'location.tertiary.address.state': prefixRegex },
        { 'location.tertiary.address.country': prefixRegex },
        { 'location.tertiary.address.zip': prefixRegex },
      ];
      providerConditions.push({ $or: addressOrs });
    }

    // Progressive text search across multiple fields
    if (searchInput) {
      const searchRegex = this.createTextSearchRegex(searchInput);
      const fuzzyRegex = this.createFuzzyRegex(searchInput);

      serviceConditions.push({
        $or: [
          { tags: searchRegex },
          { title: searchRegex },
          { description: searchRegex },
          { location: searchRegex },
        ],
      });

      providerConditions.push({
        $or: [
          { providerName: searchRegex },
          { providerName: fuzzyRegex }, // Fuzzy matching for provider names
          { providerDescription: searchRegex },
          { 'subcategories.name': searchRegex },
          { 'categories.name': searchRegex }, // Search category names directly
          { 'providerSocialMedia.facebook': searchRegex },
          { 'providerSocialMedia.instagram': searchRegex },
          { 'providerSocialMedia.twitter': searchRegex },
          { 'location.primary.address.address': searchRegex },
          { 'location.primary.address.city': searchRegex },
          { 'location.primary.address.state': searchRegex },
        ],
      });
    }

    // Enhanced category filtering with progressive matching
    const categoryFilters = [...(categories || []), ...(subcategories || [])];
    if (categoryFilters.length > 0) {
      const { categoryIds, subcategoryIds } = await this.resolveCategoryFilters(
        categoryFilters,
        true, // Use progressive matching for engine search
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
        this.executeProviderQuery(
          providerConditions,
          skip,
          limit,
          this.getProviderSortCriteria(filters.sortBy),
        ),
        this.executeServiceQuery(
          serviceConditions,
          skip,
          limit,
          this.getServiceSortCriteria(filters.sortBy),
        ),
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
    subcategories?: string[],
  ): Promise<SearchResult> {
    const { skip, limit } = pagination;

    const providerSort = this.getProviderSortCriteria(sortBy);
    const serviceSort = this.getServiceSortCriteria(sortBy);

    let providerConditions: any[] = [];
    let serviceConditions: any[] = [{ isActive: true }];

    // Combine categories and subcategories for filtering
    const categoryFilters = [...(categories || []), ...(subcategories || [])];
    if (categoryFilters.length > 0) {
      const { categoryIds, subcategoryIds } = await this.resolveCategoryFilters(
        categoryFilters,
        false, // Exact matching for non-engine search
      );

      if (categoryIds.length) {
        providerConditions.push({ categories: { $in: categoryIds } });
      }
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

  private async searchServices(
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
      minPrice,
      maxPrice,
      categories,
      subcategories,
    } = params;
    const { skip, limit } = pagination;

    const conditions: any[] = [{ isActive: true }];

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

    // Address search for services
    if (address) {
      const prefixRegex = this.createPrefixRegex(address);
      conditions.push({ location: prefixRegex });
    }

    // Price range filtering
    if (minPrice) {
      conditions.push({
        $or: [
          { minPrice: { $gte: parseFloat(minPrice) } },
          { maxPrice: { $gte: parseFloat(minPrice) } },
        ],
      });
    }
    if (maxPrice) {
      conditions.push({
        $or: [
          { maxPrice: { $lte: parseFloat(maxPrice) } },
          { minPrice: { $lte: parseFloat(maxPrice) } },
        ],
      });
    }

    // Category/Subcategory filtering
    const categoryFilters = [...(categories || []), ...(subcategories || [])];
    if (categoryFilters.length > 0) {
      const { subcategoryIds } = await this.resolveCategoryFilters(
        categoryFilters,
        useEngine,
      );
      if (subcategoryIds.length) {
        conditions.push({ subcategoryId: { $in: subcategoryIds } });
      }
    }

    const sortCriteria = this.getServiceSortCriteria(sortBy);

    const [services, totalServices] = await Promise.all([
      this.serviceModel
        .find(conditions.length ? { $and: conditions } : {})
        .populate({
          path: 'providerId',
          model: 'Provider',
          select:
            'providerName providerLogo location averageRating reviewCount',
        })
        .populate({
          path: 'subcategoryId',
          model: 'Subcategory',
          select: 'name description',
          populate: {
            path: 'categoryId',
            model: 'Category',
            select: 'name description',
          },
        })
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.serviceModel.countDocuments(
        conditions.length ? { $and: conditions } : {},
      ),
    ]);

    const totalPages = Math.ceil(totalServices / limit);

    return {
      services,
      totalPages,
      page: pagination.page,
      hasExactResults: useEngine,
    };
  }

  private async searchCategories(
    params: SearchParams,
    pagination: PaginationConfig,
    useEngine: boolean,
  ): Promise<SearchResult> {
    const { searchInput } = params;
    const { skip, limit } = pagination;

    const conditions: any[] = [];

    if (useEngine && searchInput) {
      const searchRegex = this.createTextSearchRegex(searchInput);
      conditions.push({
        $or: [{ name: searchRegex }, { description: searchRegex }],
      });
    }

    const [categories, subcategories, totalCategories, totalSubcategories] =
      await Promise.all([
        this.categoryModel
          .find(conditions.length ? { $and: conditions } : {})
          .populate({
            path: 'subcategories',
            model: 'Subcategory',
            select: 'name description',
          })
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.subcategoryModel
          .find(conditions.length ? { $and: conditions } : {})
          .populate({
            path: 'categoryId',
            model: 'Category',
            select: 'name description',
          })
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.categoryModel.countDocuments(
          conditions.length ? { $and: conditions } : {},
        ),
        this.subcategoryModel.countDocuments(
          conditions.length ? { $and: conditions } : {},
        ),
      ]);

    const totalPages = Math.ceil(
      (totalCategories + totalSubcategories) / limit,
    );

    return {
      categories,
      subcategories,
      totalPages,
      page: pagination.page,
      hasExactResults: useEngine,
    };
  }

  private async executeProviderQuery(
    conditions: any[],
    skip: number,
    limit: number,
    sortCriteria: any,
  ): Promise<Provider[]> {
    const query = conditions.length ? { $and: conditions } : {};
    return this.providerModel
      .find(query)
      .select(
        'providerName providerLogo location averageRating reviewCount categories subcategories favoriteCount createdAt providerDescription providerSocialMedia',
      )
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  private async executeServiceQuery(
    conditions: any[],
    skip: number,
    limit: number,
    sortCriteria: any,
  ): Promise<Service[]> {
    const query = conditions.length ? { $and: conditions } : {};
    return this.serviceModel
      .find(query)
      .populate({
        path: 'providerId',
        model: 'Provider',
        select:
          'providerName providerLogo location averageRating reviewCount favoriteCount',
      })
      .populate({
        path: 'subcategoryId',
        model: 'Subcategory',
        select: 'name description',
        populate: {
          path: 'categoryId',
          model: 'Category',
          select: 'name description',
        },
      })
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  private async searchJobs(
    params: SearchParams,
    pagination: PaginationConfig,
    useEngine: boolean,
  ): Promise<SearchResult> {
    const { searchInput, status, sortBy, lat, long, address, radius } = params;
    const { skip, limit } = pagination;

    const conditions: any[] = [{ isActive: true }];

    // PRIORITIZE COORDINATES OVER ADDRESS for jobs too
    if (lat && long) {
      const geoQuery = this.createGeoQuery(lat, long, radius);
      conditions.push({ coordinates: geoQuery });
    }
    // Fallback to address search if no coordinates
    else if (address) {
      const prefixRegex = this.createPrefixRegex(address);
      conditions.push({ location: prefixRegex });
    }

    if (useEngine && searchInput) {
      const searchRegex = this.createTextSearchRegex(searchInput);
      conditions.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: searchRegex }, // Use tags instead of requirements
        ],
      });
    } else if (searchInput) {
      // fallback to prefix matching if not using engine
      const prefixRegex = this.createPrefixRegex(searchInput);
      conditions.push({
        $or: [{ title: prefixRegex }, { description: prefixRegex }],
      });
    }

    if (status) {
      conditions.push({ status });
    }

    const sortCriteria = this.getJobSortCriteria(sortBy, lat, long);

    const [jobs, totalJobs] = await Promise.all([
      this.jobPostModel
        .find(conditions.length ? { $and: conditions } : {})
        .populate({
          path: 'userId',
          model: 'User',
          select: 'firstName lastName profilePic',
        })
        .populate({
          path: 'subcategoryId',
          model: 'Subcategory',
          select: 'name description',
          populate: {
            path: 'categoryId',
            model: 'Category',
            select: 'name description',
          },
        })
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit)
        .lean()
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
      Rating: { averageRating: -1, reviewCount: -1 },
      Popular: { favoriteCount: -1, reviewCount: -1 },
      Name: { providerName: 1 },
      default: { averageRating: -1, reviewCount: -1, favoriteCount: -1 },
    };

    return sortMap[sortBy[0]] || sortMap.default;
  }

  private getServiceSortCriteria(sortBy: string[] = []): any {
    const sortMap: { [key: string]: any } = {
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      PriceLow: { minPrice: 1 },
      PriceHigh: { maxPrice: -1 },
      Rating: { 'provider.averageRating': -1, 'provider.reviewCount': -1 },
      Popular: { 'provider.favoriteCount': -1 },
      default: { createdAt: -1 },
    };

    return sortMap[sortBy[0]] || sortMap.default;
  }

  private getJobSortCriteria(
    sortBy: string[] = [],
    lat?: string,
    long?: string,
  ): any {
    const sortMap: { [key: string]: any } = {
      Newest: { createdAt: -1 },
      Oldest: { createdAt: 1 },
      Deadline: { deadline: 1 },
      Urgency: { urgency: -1, createdAt: -1 },
      default: { createdAt: -1 },
    };

    return sortMap[sortBy[0]] || sortMap.default;
  }
}
