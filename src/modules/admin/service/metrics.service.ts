import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { model, Model, Types } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import { Admin, AdminDocument } from 'src/modules/admin/schemas/admin.schema';
import { CreateAdminDto } from '@dto/create-admin.dto';
import { UpdateAdminDto } from '@dto/update-admin.dto';
import { CreateUserDto } from '@dto/create-user.dto';
import { DbStorageService } from 'src/common/utils/dbStorage';
import { Provider, ProviderDocument } from '@provider/schemas/provider.schema';
import {
  MetricsRequest,
  MetricsResponse,
  TimeSeriesDataPoint,
  Insight,
} from '@types';

export interface TimeSeriesData {
  date: string;
  users: number;
  clients: number;
  providers: number;
  activeProviders: number;
}

export type TimeRange = '1d' | '7d' | '30d' | '90d' | '1y';

// Remove yearOverYear and simplify comparisons
@Injectable()
export class AdminMetricService {
  private readonly logger = new Logger(AdminMetricService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
  ) {}

  async getMetrics(request: MetricsRequest): Promise<MetricsResponse> {
    this.logger.log(`Fetching metrics: ${JSON.stringify(request)}`);

    try {
      const { startDate, endDate, previousStartDate, previousEndDate } =
        this.calculateDateRanges(request);

      // Parallel execution of all data fetching
      const [currentPeriodStats, previousPeriodStats, timeSeriesData] =
        await Promise.all([
          this.getPeriodStats(startDate, endDate),
          this.getPeriodStats(previousStartDate, previousEndDate),
          this.generateTimeSeries(startDate, endDate, request.granularity),
        ]);

      // Calculate comparison with previous period
      const comparison = this.calculateComparison(
        currentPeriodStats,
        previousPeriodStats,
      );

      // Generate insights
      const insights = this.generateInsights(
        currentPeriodStats,
        comparison,
        timeSeriesData,
      );
      // console.log({
      //   summary: {
      //     ...currentPeriodStats,
      //     growthRate: comparison.percentageChange,
      //   },
      //   timeSeries: timeSeriesData,
      //   comparison,
      //   insights,
      // });

      return {
        summary: {
          ...currentPeriodStats,
          growthRate: comparison.percentageChange,
        },
        timeSeries: timeSeriesData,
        comparison,
        insights,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch metrics', error.stack);
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
  }

  private calculateDateRanges(request: MetricsRequest) {
    let startDate: Date;
    let endDate: Date = new Date();
    let previousStartDate: Date;
    let previousEndDate: Date;

    if (request.granularity === 'monthly' && request.year) {
      // Monthly view - show all months in the selected year
      startDate = new Date(request.year, 0, 1);
      endDate = new Date(request.year, 11, 31);

      // Previous year for comparison
      previousStartDate = new Date(request.year - 1, 0, 1);
      previousEndDate = new Date(request.year - 1, 11, 31);
    } else if (
      request.granularity === 'daily' &&
      request.year &&
      request.month
    ) {
      // Daily view - show all days in selected month
      startDate = new Date(request.year, request.month - 1, 1);
      endDate = new Date(request.year, request.month, 0);

      // Previous month for comparison
      previousStartDate = new Date(request.year, request.month - 2, 1);
      previousEndDate = new Date(request.year, request.month - 1, 0);
    } else {
      // Default to last 30 days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 30);
      previousEndDate = new Date(startDate);
    }

    return { startDate, endDate, previousStartDate, previousEndDate };
  }

  private async getPeriodStats(startDate: Date, endDate: Date) {
    const [
      totalUsers,
      totalClients,
      totalProviders,
      activeProviders,
      newUsers,
    ] = await Promise.all([
      this.userModel.countDocuments(), // All time total
      this.userModel.countDocuments({ activeRole: 'Client' }),
      this.providerModel.countDocuments(),
      this.userModel.countDocuments({
        isActive: true,
        activeRole: 'Provider',
      }),
      this.userModel.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      }),
    ]);

    return {
      users: totalUsers,
      clients: totalClients,
      providers: totalProviders,
      activeProviders,
      newUsers,
    };
  }

  private async generateTimeSeries(
    startDate: Date,
    endDate: Date,
    granularity: 'daily' | 'monthly',
  ): Promise<TimeSeriesDataPoint[]> {
    const dateFormat = granularity === 'daily' ? '%Y-%m-%d' : '%Y-%m';

    const [userSeries, providerSeries] = await Promise.all([
      this.userModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: '$createdAt' },
            },
            users: { $sum: 1 },
            clients: {
              $sum: { $cond: [{ $eq: ['$activeRole', 'Client'] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.providerModel.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: '$createdAt' },
            },
            providers: { $sum: 1 },
            activeProviders: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return this.mergeTimeSeries(
      userSeries,
      providerSeries,
      granularity,
      startDate,
      endDate,
    );
  }

  private mergeTimeSeries(
    users: any[],
    providers: any[],
    granularity: 'daily' | 'monthly',
    startDate: Date,
    endDate: Date,
  ): TimeSeriesDataPoint[] {
    const map = new Map<string, TimeSeriesDataPoint>();

    // Create map from user data
    users.forEach((item) => {
      map.set(item._id, {
        date: item._id,
        label: this.formatLabel(item._id, granularity),
        users: item.users,
        clients: item.clients,
        providers: 0,
        activeProviders: 0,
      });
    });

    // Merge provider data
    providers.forEach((item) => {
      if (map.has(item._id)) {
        const existing = map.get(item._id)!;
        existing.providers = item.providers;
        existing.activeProviders = item.activeProviders;
      } else {
        map.set(item._id, {
          date: item._id,
          label: this.formatLabel(item._id, granularity),
          users: 0,
          clients: 0,
          providers: item.providers,
          activeProviders: item.activeProviders,
        });
      }
    });

    // Fill in missing dates
    this.fillMissingDates(map, startDate, endDate, granularity);

    return Array.from(map.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  private fillMissingDates(
    map: Map<string, TimeSeriesDataPoint>,
    startDate: Date,
    endDate: Date,
    granularity: 'daily' | 'monthly',
  ) {
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey =
        granularity === 'daily'
          ? current.toISOString().split('T')[0]
          : `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          label: this.formatLabel(dateKey, granularity),
          users: 0,
          clients: 0,
          providers: 0,
          activeProviders: 0,
        });
      }

      if (granularity === 'daily') {
        current.setDate(current.getDate() + 1);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }
  }

  private formatLabel(dateStr: string, granularity: string): string {
    if (granularity === 'daily') {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } else {
      const [year, month] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    }
  }

  private calculateComparison(current: any, previous: any) {
    const calculateChange = (curr: number, prev: number) =>
      prev ? ((curr - prev) / prev) * 100 : 0;

    return {
      usersChange: current.users - previous.users,
      clientsChange: current.clients - previous.clients,
      providersChange: current.providers - previous.providers,
      activeProvidersChange: current.activeProviders - previous.activeProviders,
      newUsersChange: current.newUsers - previous.newUsers,
      percentageChange: calculateChange(current.newUsers, previous.newUsers),
    };
  }

  private generateInsights(
    current: any,
    comparison: any,
    timeSeries: any[],
  ): Insight[] {
    const insights: Insight[] = [];

    if (current.newUsers > 0) {
      insights.push({
        type: 'positive',
        message: `${current.newUsers} new users joined in this period`,
        metric: 'newUsers',
        value: current.newUsers,
      });
    }

    if (comparison.percentageChange > 10) {
      insights.push({
        type: 'positive',
        message: `New user growth of ${comparison.percentageChange.toFixed(1)}% vs previous period`,
        metric: 'growthRate',
        value: comparison.percentageChange,
      });
    } else if (comparison.percentageChange < -10) {
      insights.push({
        type: 'negative',
        message: `New user decline of ${Math.abs(comparison.percentageChange).toFixed(1)}% vs previous period`,
        metric: 'growthRate',
        value: comparison.percentageChange,
      });
    }

    // Best day/month insight
    if (timeSeries.length > 0) {
      const bestPeriod = timeSeries.reduce((best, current) =>
        current.users > best.users ? current : best,
      );

      insights.push({
        type: 'neutral',
        message: `Best period was ${bestPeriod.label} with ${bestPeriod.users} new users`,
        metric: 'bestPeriod',
        value: bestPeriod.users,
      });
    }

    return insights;
  }
}
