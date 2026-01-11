// src/modules/search/search.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Provider, ProviderDocument } from '@schemas/provider.schema';
import { GlobalSearchDto } from './dto/search.dto';
import { AnyCaaRecord } from 'dns';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Provider.name)
    private readonly providerModel: Model<ProviderDocument>,
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
      featured,
      sortBy = 'Relevance',
      searchInput,
      address,
    } = dto;

    if (model !== 'providers') {
      throw new BadRequestException('Only providers supported for now');
    }

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(Number(limit), 50);
    const skip = (pageNumber - 1) * pageSize;

    if (engine) {
      return this.engineSearch({
        searchInput,
        address,
        country,
        sortBy,
        skip,
        pageSize,
      });
    }

    return this.discoverySearch({
      lat,
      long,
      city,
      state,
      country,
      subcategories,
      featured,
      sortBy,
      skip,
      pageSize,
      pageNumber,
    });
  }

  private async engineSearch(params: {
    searchInput?: string;
    address?: string;
    country?: string;
    sortBy: string;
    skip: number;
    pageSize: number;
  }) {
    const { searchInput, address, country, sortBy, skip, pageSize } = params;

    if (!country) {
      throw new BadRequestException('Country is required');
    }

    // ADDRESS AUTOCOMPLETE (typing)
    if (address && !searchInput) {
      const suggestions = await this.providerModel.aggregate([
        {
          $match: {
            'location.primary.address.country': country,
            'location.primary.address.address': {
              $regex: `^${address}`,
              $options: 'i',
            },
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

      return { suggestions };
    }

    // FULL SEARCH
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
          $or: [
            { providerName: { $regex: searchInput, $options: 'i' } },
            { providerDescription: { $regex: searchInput, $options: 'i' } },
          ],
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
      providers,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async discoverySearch(params: {
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
      providers,
      page: pageNumber,
      totalPages: Math.ceil(total / pageSize),
      featuredRatio:
        providers.length === 0
          ? 0
          : providers.filter((p) => p.isFeatured).length / providers.length,
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
}
