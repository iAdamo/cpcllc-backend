import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider, ProviderDocument } from '@schemas/provider.schema';
import { GlobalSearchDto } from './dto/search.dto';
import { JobPost, JobPostDocument } from '@services/schemas/job.schema';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
    @InjectModel(JobPost.name)
    private readonly jobModel: Model<JobPostDocument>,
  ) {}

  async globalSearch(dto: GlobalSearchDto) {
    const {
      model,
      engine = false,
      page,
      limit,
      lat,
      long,
      city,
      state,
      country,
      subcategories,
      providerSubcategories,
      featured,
      urgency,
      sortBy = 'Relevance',
      searchInput,
      address,
    } = dto;

    if (model !== 'providers' && model !== 'jobs') {
      throw new BadRequestException(
        'Only providers and jobs are supported for now',
      );
    }

    if (country && country === 'Estados Unidos') {
      dto.country = 'United States';
    }

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(Number(limit), 50);
    const skip = (pageNumber - 1) * pageSize;

    if (engine) {
      return this.engineSearch({
        model,
        searchInput,
        address,
        country,
        sortBy,
        providerSubcategories,
        skip,
        pageNumber,
        pageSize,
      });
    }

    return this.discoverySearch({
      model,
      lat,
      long,
      city,
      state,
      country,
      subcategories,
      featured,
      urgency,
      sortBy,
      skip,
      pageSize,
      pageNumber,
      providerSubcategories,
    });
  }

  private async engineSearch(params: {
    model: string;
    searchInput?: string;
    address?: string;
    country?: string;
    sortBy: string;
    providerSubcategories;
    skip: number;
    pageNumber: number;
    pageSize: number;
  }) {
    const {
      model,
      searchInput,
      address,
      country,
      sortBy,
      providerSubcategories,
      skip,
      pageNumber,
      pageSize,
    } = params;

    if (!country) {
      throw new BadRequestException('Country is required');
    }

    if (model === 'providers') {
      return this.providerEngineSearch({
        searchInput,
        address,
        country,
        sortBy,
        skip,
        pageNumber,
        pageSize,
      });
    } else if (model === 'jobs') {
      return this.jobEngineSearch({
        searchInput,
        country,
        sortBy,
        skip,
        pageNumber,
        pageSize,
        providerSubcategories,
      });
    } else {
      throw new BadRequestException(`Model ${model} is not supported`);
    }
  }
  private async providerEngineSearch(params: {
    searchInput?: string;
    address?: string;
    country?: string;
    sortBy: string;
    skip: number;
    pageNumber: number;
    pageSize: number;
  }) {
    const { searchInput, address, country, sortBy, skip, pageSize } = params;
    const isAutocomplete = address && (!searchInput || searchInput !== 'pass');

    const isAddressSearch = address && searchInput === 'pass';

    if (isAutocomplete) {
      const suggestions = await this.providerModel.aggregate([
        {
          $match: {
            'location.primary.address.country': country,
            $or: [
              {
                'location.primary.address.state': {
                  $regex: `^${address}`,
                  $options: 'i',
                },
              },
              {
                'location.primary.address.city': {
                  $regex: `^${address}`,
                  $options: 'i',
                },
              },

              {
                'location.primary.address.address': {
                  $regex: address,
                  $options: 'i',
                },
              },
            ],
          },
        },
        {
          $project: {
            providerId: '$_id',
            address: '$location.primary.address.address',
            city: '$location.primary.address.city',
            state: '$location.primary.address.state',
          },
        },
        { $limit: 10 },
      ]);

      return {
        type: 'suggestions',
        data: { suggestions },
      };
    }

    if (isAddressSearch) {
      const pipeline: any[] = [
        {
          $match: {
            'location.primary.address.country': country,
            $or: [
              {
                'location.primary.address.address': {
                  $regex: address,
                  $options: 'i',
                },
              },
              {
                'location.primary.address.city': {
                  $regex: `^${address}`,
                  $options: 'i',
                },
              },
              {
                'location.primary.address.state': {
                  $regex: `^${address}`,
                  $options: 'i',
                },
              },
            ],
          },
        },
      ];

      this.applySorting(pipeline, sortBy);

      const countPipeline = [...pipeline, { $count: 'total' }];

      pipeline.push({ $skip: skip }, { $limit: pageSize });

      const [providers, count] = await Promise.all([
        this.providerModel.aggregate(pipeline),
        this.providerModel.aggregate(countPipeline),
      ]);

      const total = count[0]?.total || 0;

      return {
        type: 'providers',
        data: {
          providers,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }

    /**
     * ─────────────────────────────
     * FULL SEARCH
     * ─────────────────────────────
     */
    const pipeline: any[] = [
      {
        $match: {
          'location.primary.address.country': country,
        },
      },
    ];

    if (searchInput) {
      pipeline.push({
        $match: {
          $or: [{ providerName: { $regex: searchInput, $options: 'i' } }],
        },
      });
    }

    this.applySorting(pipeline, sortBy);

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push({ $skip: skip }, { $limit: pageSize });

    const [providers, count] = await Promise.all([
      this.providerModel.aggregate(pipeline),
      this.providerModel.aggregate(countPipeline),
    ]);

    const total = count[0]?.total || 0;

    return {
      type: 'providers',
      data: {
        providers,
      },
      totalPages: Math.ceil(total / pageSize),
    };
  }
  private async jobEngineSearch(params: {
    searchInput?: string;
    country?: string;
    sortBy: string;
    skip: number;
    pageNumber: number;
    pageSize: number;
    providerSubcategories?: string[];
  }) {
    const {
      searchInput,
      country,
      sortBy,
      skip,
      pageSize,
      pageNumber,
      providerSubcategories,
    } = params;
    // console.log(params);
    const pipeline: any[] = [
      {
        $match: {
          'location.address.country': country,
          status: 'Active',
        },
      },
    ];

    //  if (providerSubcategories?.length) {
    //    pipeline.push({
    //      $match: {
    //        subcategoryId: {
    //          $in: providerSubcategories.map((id) => new Types.ObjectId(id)),
    //        },
    //      },
    //    });
    //  }
    if (searchInput) {
      pipeline.push({
        $match: {
          $or: [
            { title: { $regex: searchInput, $options: 'i' } },
            { description: { $regex: searchInput, $options: 'i' } },
            { tags: { $in: [new RegExp(searchInput, 'i')] } },
          ],
        },
      });
    }

    // Sorting for jobs
    switch (sortBy) {
      case 'Newest':
        pipeline.push({ $sort: { createdAt: -1 } });
        break;
      case 'Budget_High':
        pipeline.push({ $sort: { budget: -1 } });
        break;
      case 'Budget_Low':
        pipeline.push({ $sort: { budget: 1 } });
        break;
      default:
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push({ $skip: skip }, { $limit: pageSize });
    this.addJobLookups(pipeline);
    const [jobs, count] = await Promise.all([
      this.jobModel.aggregate(pipeline),
      this.jobModel.aggregate(countPipeline),
    ]);

    const total = count[0]?.total || 0;

    return {
      type: 'jobs',
      data: { jobs },
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async discoverySearch(params: {
    model: string;
    lat?: number;
    long?: number;
    city?: string;
    state?: string;
    country?: string;
    subcategories?: string[];
    featured?: boolean;
    urgency?: string;
    sortBy: string;
    skip: number;
    pageSize: number;
    pageNumber: number;
    providerSubcategories?: string[];
  }) {
    const {
      model,
      lat,
      long,
      city,
      state,
      country,
      subcategories,
      featured,
      urgency,
      sortBy,
      skip,
      pageNumber,
      pageSize,
      providerSubcategories,
    } = params;

    if (model === 'providers') {
      return this.providerDiscoverySearch({
        lat,
        long,
        city,
        state,
        country,
        subcategories,
        featured,
        sortBy,
        skip,
        pageNumber,
        pageSize,
      });
    } else if (model === 'jobs') {
      return this.jobDiscoverySearch({
        lat,
        long,
        city,
        state,
        country,
        subcategories,
        urgency,
        sortBy,
        skip,
        pageNumber,
        pageSize,
        providerSubcategories,
      });
    } else {
      throw new BadRequestException(`Model ${model} is not supported`);
    }
  }

  private async providerDiscoverySearch(params: {
    lat?: number;
    long?: number;
    city?: string;
    state?: string;
    country?: string;
    subcategories?: string[];
    featured?: boolean;
    sortBy: string;
    skip: number;
    pageSize: number;
    pageNumber: number;
  }) {
    const {
      lat,
      long,
      city,
      state,
      country,
      subcategories,
      featured,
      sortBy,
      skip,
      pageNumber,
      pageSize,
    } = params;

    if (!lat || !long || !country) {
      throw new BadRequestException('Location fields are required');
    }

    // 🔁 changes every 30 minutes
    const rotationSeed = Math.floor(Date.now() / (1000 * 60 * 30));

    const pipeline: any[] = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [Number(long), Number(lat)],
          },
          distanceField: 'distance',
          spherical: true,
        },
      },
      {
        $match: {
          'location.primary.address.country': country,
        },
      },

      // 📍 Location priority
      {
        $addFields: {
          locationPriority: {
            $cond: [
              { $lte: ['$distance', 1000] },
              1,
              {
                $cond: [
                  { $eq: ['$location.primary.address.city', city] },
                  2,
                  {
                    $cond: [
                      { $eq: ['$location.primary.address.state', state] },
                      3,
                      4,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },

      // 🎯 Base relevance score
      {
        $addFields: {
          relevanceScore: {
            $add: [
              { $multiply: [{ $subtract: [5, '$averageRating'] }, -2] },
              { $multiply: ['$reviewCount', 0.1] },
              { $multiply: [{ $subtract: [5, '$locationPriority'] }, 2] },
            ],
          },
        },
      },

      // ⭐ Featured boost (≈60% dominance)
      {
        $addFields: {
          featuredBoost: {
            $cond: [
              '$isFeatured',
              featured ? 6 : 3, // stronger when featured=true
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          createdAtTs: { $toLong: { $toDate: '$_id' } },
        },
      },
      {
        $addFields: {
          rotationScore: {
            $mod: [
              {
                $add: [
                  '$createdAtTs',
                  Math.floor(Date.now() / (30 * 60 * 1000)),
                ],
              },
              1000,
            ],
          },
        },
      },
      {
        $sort: { rotationScore: 1 },
      },
      // 🧮 Final score
      {
        $addFields: {
          finalScore: {
            $add: [
              '$relevanceScore',
              '$featuredBoost',
              { $multiply: ['$randomFactor', 0.001] },
            ],
          },
        },
      },
    ];

    // 🎯 Category filter
    if (subcategories?.length) {
      pipeline.push({
        $match: {
          subcategories: {
            $in: subcategories.map((id) => new Types.ObjectId(id)),
          },
        },
      });
    }

    // 📊 Sort
    pipeline.push({ $sort: { finalScore: -1 } });

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push({ $skip: skip }, { $limit: pageSize });

    this.addProviderLookups(pipeline);

    const [providers, count] = await Promise.all([
      this.providerModel.aggregate(pipeline),
      this.providerModel.aggregate(countPipeline),
    ]);

    const total = count[0]?.total || 0;

    return {
      type: 'providers',
      data: {
        providers,
      },
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      featuredRatio:
        providers.length === 0
          ? 0
          : providers.filter((p) => p.isFeatured).length / providers.length,
    };
  }

  private async jobDiscoverySearch(params: {
    lat?: number;
    long?: number;
    city?: string;
    state?: string;
    country?: string;
    subcategories?: string[];
    urgency?: string;
    sortBy: string;
    skip: number;
    pageSize: number;
    pageNumber: number;
    providerSubcategories?: string[];
  }) {
    const {
      lat,
      long,
      city,
      state,
      country,
      subcategories,
      urgency,
      sortBy,
      skip,
      pageNumber,
      pageSize,
      providerSubcategories,
    } = params;
    if (!lat || !long || !country) {
      throw new BadRequestException('Location fields are required');
    }

    const pipeline: any[] = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [Number(long), Number(lat)],
          },
          distanceField: 'distance',
          spherical: true,
        },
      },
      {
        $match: {
          'location.address.country': country,
          status: 'Active', // Only show active jobs
        },
      },
      // Location priority
      {
        $addFields: {
          locationPriority: {
            $cond: [
              { $lte: ['$distance', 1000] },
              1,
              {
                $cond: [
                  { $eq: ['$location.address.city', city] },
                  2,
                  {
                    $cond: [{ $eq: ['$location.address.state', state] }, 3, 4],
                  },
                ],
              },
            ],
          },
        },
      },
      // Urgency boost (Urgent: 50%, Immediate: 30%, Normal: 20%)
      {
        $addFields: {
          urgencyBoost: {
            $switch: {
              branches: [
                { case: { $eq: ['$urgency', 'Urgent'] }, then: 5.0 },
                { case: { $eq: ['$urgency', 'Immediate'] }, then: 3.0 },
                { case: { $eq: ['$urgency', 'Normal'] }, then: 2.0 },
              ],
              default: 1.0,
            },
          },
        },
      },
      // 🎯 Filter by provider's subcategories
      ...(providerSubcategories?.length
        ? [
            {
              $match: {
                subcategoryId: {
                  $in: providerSubcategories.map(
                    (id) => new Types.ObjectId(id),
                  ),
                },
              },
            },
          ]
        : []),

      // 🎯 Additional subcategory filter if provided
      ...(subcategories?.length
        ? [
            {
              $match: {
                subcategoryId: {
                  $in: subcategories.map((id) => new Types.ObjectId(id)),
                },
              },
            },
          ]
        : []),
      // Additional urgency filter if specified
      ...(urgency
        ? [
            {
              $match: {
                urgency: urgency,
              },
            },
          ]
        : []),

      {
        $addFields: {
          finalScore: {
            $add: [
              { $multiply: [{ $subtract: [5, '$locationPriority'] }, 3] },
              '$urgencyBoost',
              // Newness boost (jobs posted within 24 hours get extra points)
              {
                $cond: [
                  {
                    $gt: [
                      '$createdAt',
                      new Date(Date.now() - 24 * 60 * 60 * 1000),
                    ],
                  },
                  2,
                  0,
                ],
              },
            ],
          },
        },
      },
    ];
    pipeline.push({ $sort: { finalScore: -1, createdAt: -1 } });

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push({ $skip: skip }, { $limit: pageSize });
    this.addJobLookups(pipeline);

    const [jobs, count] = await Promise.all([
      this.jobModel.aggregate(pipeline),
      this.jobModel.aggregate(countPipeline),
    ]);
    // console.log(jobs);
    const total = count[0]?.total || 0;
    return {
      type: 'jobs',
      data: { jobs },
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private applySorting(pipeline: any[], sortBy: string) {
    switch (sortBy) {
      case 'Newest':
        pipeline.push({ $sort: { createdAt: -1 } });
        break;

      case 'Oldest':
        pipeline.push({ $sort: { createdAt: 1 } });
        break;

      case 'Top Rated':
        pipeline.push({ $sort: { averageRating: -1 } });
        break;

      case 'Most Reviewed':
        pipeline.push({ $sort: { reviewCount: -1 } });
        break;

      default:
        pipeline.push({ $sort: { isFeatured: -1, averageRating: -1 } });
    }
  }

  private addProviderLookups(pipeline: any[]) {
    pipeline.push(
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategories',
          foreignField: '_id',
          as: 'subcategories',
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'subcategories.categoryId',
          foreignField: '_id',
          as: 'categories',
        },
      },
    );
  }

  private addJobLookups(pipeline: any[]) {
    pipeline.push(
      // ---------- Subcategory
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategoryId',
          foreignField: '_id',
          as: 'subcategory',
        },
      },
      {
        $unwind: {
          path: '$subcategory',
          preserveNullAndEmptyArrays: true,
        },
      },

      // ---------- Category (USES subcategory.categoryId)
      {
        $lookup: {
          from: 'categories',
          localField: 'subcategory.categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      {
        $unwind: {
          path: '$category',
          preserveNullAndEmptyArrays: true,
        },
      },

      // ---------- User (client)
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'client',
        },
      },
      {
        $unwind: {
          path: '$client',
          preserveNullAndEmptyArrays: true,
        },
      },

      // ---------- FINAL reshaping (THIS was the missing piece)
      {
        $addFields: {
          id: '$_id',

          userId: {
            $cond: [
              { $gt: ['$client', null] },
              {
                _id: '$client._id',
                firstName: '$client.firstName',
                lastName: '$client.lastName',
                createdAt: '$client.createdAt',
                profilePicture: '$client.profilePicture',
                averageRating: '$client.rating',
                reviewCount: '$client.reviewCount',
              },
              {},
            ],
          },

          subcategoryId: {
            $cond: [
              { $gt: ['$subcategory', null] },
              {
                _id: '$subcategory._id',
                name: '$subcategory.name',
                description: '$subcategory.description',
                categoryId: {
                  _id: '$category._id',
                  name: '$category.name',
                  description: '$category.description',
                },
              },
              {},
            ],
          },
        },
      },

      // ---------- cleanup
      {
        $project: {
          client: 0,
          subcategory: 0,
          category: 0,
        },
      },
    );
  }
}
