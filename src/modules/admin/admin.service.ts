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
export interface MetricsResponse {
  summary: {
    users: number;
    clients: number;
    providers: number;
    activeProviders: number;
  };
  timeSeries: TimeSeriesData[];
}

export interface TimeSeriesData {
  date: string;
  users: number;
  clients: number;
  providers: number;
  activeProviders: number;
}

export type TimeRange = '1d' | '7d' | '30d' | '90d' | '1y';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    private readonly storage: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  /**
   * Create an Admin
   * @param id User ID
   * @param createAdminDto Admin Data
   * @returns Created Admin
   */
  async createAdmin(
    id: string,
    createAdminDto: CreateAdminDto,
  ): Promise<Admin> {
    if (!id)
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);

    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);

    const admin = await this.adminModel.create({ ...createAdminDto, user: id });

    await this.userModel.findByIdAndUpdate(id, {
      activeRole: 'Admin',
      activeRoleId: admin._id,
    });

    return admin;
  }

  /**
   * Get Admin by ID
   * @param id Admin ID
   * @returns Admin details
   */
  async getAdminById(id: string): Promise<Admin> {
    if (!id)
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);

    const admin = await this.adminModel
      .findById(id)
      .populate('user', 'email name profilePicture');

    if (!admin) throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);

    return admin;
  }

  /**
   * Get all Users
   * @returns List of Users
   */
  async getAllUsers(
    page: string,
    limit: string,
  ): Promise<{ users: User[]; totalPages: number }> {
    const pageN = parseInt(page);
    const limitN = parseInt(limit);

    if (isNaN(pageN) || pageN <= 0) {
      throw new BadRequestException('Page must be a positive number');
    }

    if (isNaN(limitN) || limitN <= 0) {
      throw new BadRequestException('Limit must be a positive number');
    }
    const totalUsers = await this.userModel.countDocuments();
    if (totalUsers === 0) {
      return { users: [], totalPages: 0 };
    }
    const totalPages = Math.ceil(totalUsers / limitN);
    const users = await this.userModel
      .find()
      .skip((pageN - 1) * limitN)
      .limit(limitN)
      .populate('hiredProviders')
      .populate({
        path: 'activeRoleId',
        model: 'Company',
      })
      .exec();
    return { users, totalPages };
  }

  async deleteAdmin(id: string): Promise<void> {
    if (!id)
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);

    const admin = await this.adminModel.findById(id);
    if (!admin) throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);
    await this.adminModel.findByIdAndDelete(id);
    await this.userModel.findByIdAndUpdate(admin.user, {
      activeRole: null,
      activeRoleId: null,
    });
    await this.storage.deleteUserFiles(admin.user.toString());
    return;
  }

  /**
   * Update Admin details
   * @param id Admin ID
   * @param updateAdminDto Updated Admin Data
   * @param files Files to upload
   * @returns Updated Admin
   */
  async updateAdmin(
    id: string,
    updateAdminDto: Partial<UpdateAdminDto>,
    files?: Express.Multer.File[],
  ): Promise<Admin> {
    if (!id)
      throw new BadRequestException(this.ERROR_MESSAGES.USER_ID_REQUIRED);

    const admin = await this.adminModel.findById(id);
    if (!admin) throw new NotFoundException(this.ERROR_MESSAGES.USER_NOT_FOUND);
    const updatePayload: any = { ...updateAdminDto };
    if (files && files.length > 0) {
      try {
        const uploadedFiles = await this.storage.handleFileUpload(
          admin.user.toString(),
          files,
        );

        const uploaded = uploadedFiles[0];
        const currentProfile =
          typeof admin.profilePicture === 'string' && admin.profilePicture
            ? { type: 'image', url: admin.profilePicture, thumbnail: null }
            : admin.profilePicture || null;

        updatePayload.profilePicture = uploaded
          ? {
              type: uploaded.type || 'image',
              url: uploaded.url,
              thumbnail: uploaded.thumbnail || null,
            }
          : currentProfile;
      } catch (error) {
        throw new InternalServerErrorException(
          this.ERROR_MESSAGES.FILE_UPLOAD_FAILED,
        );
      }
    }

    const updatedAdmin = await this.adminModel
      .findByIdAndUpdate(id, updatePayload, { new: true, runValidators: true })
      .populate('user', 'email name profilePicture')
      .exec();
    return updatedAdmin;
  }

  /**
   * Get dashboard metrics for a specified time range
   * @param range - Time range (7d, 30d, 90d, 1y)
   * @returns Promise with summary counts and time series data
   */
  async getMetrics(range: TimeRange = '30d'): Promise<MetricsResponse> {
    this.logger.log(`Fetching metrics for range: ${range}`);

    try {
      const { startDate } = this.resolveRange(range);

      // Execute all independent queries in parallel for better performance
      const [
        totalUsers,
        totalClients,
        totalProviders,
        activeProviders,
        timeSeries,
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getTotalClients(),
        this.getTotalProviders(),
        this.getActiveProviders(),
        this.generateTimeSeries(startDate),
      ]);

      const summary = {
        users: totalUsers,
        clients: totalClients,
        providers: totalProviders,
        activeProviders,
      };

      // this.logger.debug(
      //   'Metrics fetched successfully',
      //   { summary },
      //   { timeSeries },
      // );

      return { summary, timeSeries };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch metrics for range ${range}`,
        error?.stack,
      );
      throw new Error(`Failed to fetch metrics: ${error?.message}`);
    }
  }

  // -----------------------
  // PRIVATE HELPER METHODS
  // -----------------------

  private async getTotalUsers(): Promise<number> {
    return this.userModel.countDocuments();
  }

  private async getTotalClients(): Promise<number> {
    return this.userModel.countDocuments({ activeRole: 'Client' });
  }

  private async getTotalProviders(): Promise<number> {
    return this.providerModel.countDocuments();
  }

  private async getActiveProviders(): Promise<number> {
    return this.userModel.countDocuments({
      isActive: true,
      activeRole: 'Provider',
    });
  }

  /**
   * Resolve start date based on range string
   */
  private resolveRange(range: TimeRange): { startDate: Date } {
    const now = new Date();
    const startDate = new Date(now);

    const rangeMap: Record<TimeRange, () => void> = {
      '1d': () => startDate.setDate(now.getDate() - 1),
      '7d': () => startDate.setDate(now.getDate() - 7),
      '30d': () => startDate.setDate(now.getDate() - 30),
      '90d': () => startDate.setDate(now.getDate() - 90),
      '1y': () => startDate.setFullYear(now.getFullYear() - 1),
    };

    const setRange = rangeMap[range] || rangeMap['30d'];
    setRange();
console.log(`Resolved range ${range} to start date: ${startDate.toISOString()}`);
    return { startDate };
  }

  /**
   * Generate time series data for users and providers
   */
  private async generateTimeSeries(startDate: Date): Promise<TimeSeriesData[]> {
    // Create aggregation pipelines
    const userPipeline = this.createTimeSeriesPipeline(startDate, 'user');
    const providerPipeline = this.createTimeSeriesPipeline(
      startDate,
      'provider',
    );

    // Execute aggregations in parallel
    const [users, providers] = await Promise.all([
      this.userModel.aggregate(userPipeline),
      this.providerModel.aggregate(providerPipeline),
    ]);

    // Merge results efficiently using Map
    return this.mergeTimeSeriesData(users, providers);
  }

  /**
   * Create MongoDB aggregation pipeline for time series data
   */
  private createTimeSeriesPipeline(
    startDate: Date,
    type: 'user' | 'provider',
  ): any[] {
    const basePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate },
          ...(type === 'provider' ? {} : { activeRole: { $exists: true } }), // Only for users collection
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    // Add provider-specific fields if needed
    if (type === 'provider') {
      // Could add additional provider-specific aggregations here
    }

    return basePipeline;
  }

  /**
   * Merge user and provider time series data
   */
  private mergeTimeSeriesData(
    users: Array<{ _id: string; count: number }>,
    providers: Array<{ _id: string; count: number }>,
  ): TimeSeriesData[] {
    const timeSeriesMap = new Map<string, TimeSeriesData>();

    // Process user data
    users.forEach((user) => {
      timeSeriesMap.set(user._id, {
        date: user._id,
        users: user.count,
        clients: user.count, // Assuming all users are clients in this context
        providers: 0,
        activeProviders: 0,
      });
    });

    // Process provider data
    providers.forEach((provider) => {
      const existing = timeSeriesMap.get(provider._id);

      if (existing) {
        existing.providers = provider.count;
      } else {
        timeSeriesMap.set(provider._id, {
          date: provider._id,
          users: 0,
          clients: 0,
          providers: provider.count,
          activeProviders: 0,
        });
      }
    });

    // Fill in missing dates if needed
    this.fillMissingDates(timeSeriesMap);

    return Array.from(timeSeriesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  /**
   * Fill in missing dates to ensure continuous time series
   */
  private fillMissingDates(map: Map<string, TimeSeriesData>): void {
    if (map.size === 0) return;

    const dates = Array.from(map.keys()).sort();
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      if (!map.has(dateStr)) {
        map.set(dateStr, {
          date: dateStr,
          users: 0,
          clients: 0,
          providers: 0,
          activeProviders: 0,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
}
