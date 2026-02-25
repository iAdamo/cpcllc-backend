import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User, UserDocument } from '@schemas/user.schema';
import { Presence, PresenceDocument } from '@schemas/presence.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DeactivationService {
  private readonly logger = new Logger(DeactivationService.name);
  private readonly DEACTIVATION_GRACE_PERIOD_DAYS = 30;
  private readonly BATCH_SIZE = 100;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Presence.name)
    private readonly presenceModel: Model<PresenceDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Deactivate a user account with comprehensive validation
   */
  async deactivateAccount(
    userId: string,
    data: {
      password?: string;
      reason: string;
      initiatedBy: 'Client' | 'Admin';
      adminId?: string;
      shouldDeleteAfter30Days?: boolean;
    },
  ): Promise<{ message: string; scheduledDeletionDate?: Date }> {
    const startTime = Date.now();
    this.logger.log(`Starting account deactivation for user: ${userId}`);

    try {
      // Validate user ID
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Find user with lean for faster query
      const user = await this.userModel.findById(userId).lean();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if already deactivated/deleted
      if (!user.isActive) {
        throw new BadRequestException('Account is already deactivated');
      }

      if (user.isDeleted) {
        throw new BadRequestException(
          'Account is already scheduled for deletion',
        );
      }

      // Password validation for client-initiated deactivation
      if (data.initiatedBy === 'Client') {
        if (!data.password) {
          throw new BadRequestException(
            'Password is required for account deactivation',
          );
        }

        const isPasswordValid = await bcrypt.compare(
          data.password,
          user.password,
        );
        if (!isPasswordValid) {
          this.logger.warn(
            `Failed password attempt for user deactivation: ${userId}`,
          );
          throw new BadRequestException('Current password is incorrect');
        }
      }

      // Admin validation
      if (data.initiatedBy === 'Admin' && !data.adminId) {
        throw new BadRequestException('Admin ID is required');
      }

      // Prevent deactivation if user has active sessions
      // const activeSessions = await this.presenceModel.countDocuments({
      //   userId: new Types.ObjectId(userId),
      //   status: 'ONLINE',
      // });

      // if (activeSessions > 0 && data.initiatedBy === 'Client') {
      //   throw new BadRequestException(
      //     'Please log out from all devices before deactivating your account',
      //   );
      // }

      // Calculate scheduled deletion date
      const scheduledDeletionDate = data.shouldDeleteAfter30Days
        ? new Date(
            Date.now() +
              this.DEACTIVATION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
          )
        : null;

      // Use transaction for data consistency
      const session = await this.userModel.startSession();

      try {
        await session.withTransaction(async () => {
          // Update user with deactivation details
          await this.userModel.findByIdAndUpdate(
            userId,
            {
              $set: {
                isActive: false,
                deactivation: {
                  reason: data.reason,
                  date: new Date(),
                  initiatedBy: data.initiatedBy,
                  adminId: data.adminId,
                },
                ...(scheduledDeletionDate && {
                  deletionRequestedAt: new Date(),
                  scheduledDeletionAt: scheduledDeletionDate,
                }),
                // Clear sensitive session data
                devices: [],
                code: null,
                codeAt: null,
                forgetPassword: false,
              },
            },
            { session, new: true },
          );

          // Force logout from all devices
          await this.presenceModel.deleteMany(
            { userId: new Types.ObjectId(userId) },
            { session },
          );
        });

        await session.endSession();

        // Emit events for cleanup
        this.eventEmitter.emit('user.deactivated', {
          userId,
          reason: data.reason,
          initiatedBy: data.initiatedBy,
          scheduledDeletionDate,
        });

        // Log audit trail
        this.logger.log({
          message: 'Account deactivated successfully',
          userId,
          initiatedBy: data.initiatedBy,
          duration: Date.now() - startTime,
          scheduledDeletion: !!scheduledDeletionDate,
        });

        const response: { message: string; scheduledDeletionDate?: Date } = {
          message: 'Account deactivated successfully',
        };

        if (scheduledDeletionDate) {
          response.scheduledDeletionDate = scheduledDeletionDate;
        }

        return response;
      } catch (error: any) {
        await session.endSession();
        throw error;
      }
    } catch (error: any) {
      this.logger.error({
        message: 'Account deactivation failed',
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Reactivate a deactivated account
   * @param userId
   * @param data
   * @returns
   */
  async reactivateAccount(
    userId: string,
    data: {
      password?: string;
      initiatedBy: 'Client' | 'Admin';
      adminId?: string;
    },
  ): Promise<{ message: string }> {
    try {
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.isActive) return;

      if (user.isDeleted) {
        throw new BadRequestException(
          'Cannot reactivate an account scheduled for deletion',
        );
      }

      // Check if grace period has expired
      if (user.scheduledDeletionAt && user.scheduledDeletionAt < new Date()) {
        throw new BadRequestException(
          'Reactivation period has expired. Please create a new account.',
        );
      }

      // Validate based on who's initiating
      if (data.initiatedBy === 'Client') {
        if (!data.password) {
          throw new BadRequestException('Password is required');
        }

        const isPasswordValid = await bcrypt.compare(
          data.password,
          user.password,
        );
        if (!isPasswordValid) {
          throw new BadRequestException('Password is incorrect');
        }

        // Check if reactivation is within grace period
        if (user.scheduledDeletionAt) {
          const daysUntilDeletion = Math.ceil(
            (user.scheduledDeletionAt.getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          );

          if (daysUntilDeletion <= 0) {
            throw new BadRequestException('Reactivation period has expired');
          }
        }
      }

      // Reactivate account
      await this.userModel.findByIdAndUpdate(userId, {
        $set: {
          isActive: true,
          deactivation: null,
          deletionRequestedAt: null,
          scheduledDeletionAt: null,
        },
      });

      this.eventEmitter.emit('user.reactivated', {
        userId,
        initiatedBy: data.initiatedBy,
      });

      this.logger.log(`Account reactivated: ${userId}`);
      return { message: 'Account reactivated successfully' };
    } catch (error: any) {
      this.logger.error(`Account reactivation failed: ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel scheduled deletion
   */
  async cancelDeletion(
    userId: string,
    password?: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.scheduledDeletionAt) {
        throw new BadRequestException('No deletion scheduled for this account');
      }

      // Verify password for security
      if (password) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          throw new BadRequestException('Password is incorrect');
        }
      }

      await this.userModel.findByIdAndUpdate(userId, {
        $set: {
          isActive: true,
          deactivation: null,
          deletionRequestedAt: null,
          scheduledDeletionAt: null,
        },
      });

      this.logger.log(`Deletion cancelled: ${userId}`);
      return { message: 'Account deletion cancelled successfully' };
    } catch (error: any) {
      this.logger.error(`Cancel deletion failed: ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Cron job to permanently delete accounts after 30 days
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processScheduledDeletions() {
    this.logger.log('Starting scheduled account deletions');

    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;

    try {
      const now = new Date();

      while (true) {
        // Fetch next batch
        const usersToDelete = await this.userModel
          .find({
            scheduledDeletionAt: { $lte: now },
            isDeleted: false,
          })
          .limit(this.BATCH_SIZE)
          .lean();

        // Stop when no more users
        if (!usersToDelete.length) {
          break;
        }

        this.logger.log(`Processing batch of ${usersToDelete.length} users`);

        for (const user of usersToDelete) {
          try {
            await this.permanentDeleteUser(user._id.toString());
            processedCount++;

            if (processedCount % 10 === 0) {
              this.logger.log(
                `Processed ${processedCount} total deletions so far`,
              );
            }
          } catch (error: any) {
            errorCount++;

            this.logger.error({
              message: 'Failed to delete user',
              userId: user._id,
              error: error.message,
            });

            await this.userModel.findByIdAndUpdate(user._id, {
              $inc: { deletionRetryCount: 1 },
              $set: { lastDeletionAttempt: new Date() },
            });
          }
        }
      }

      this.logger.log({
        message: 'Scheduled deletions completed',
        duration: `${Date.now() - startTime}ms`,
        processed: processedCount,
        errors: errorCount,
      });

      this.eventEmitter.emit('deletion.batch.completed', {
        processedCount,
        errorCount,
        duration: Date.now() - startTime,
      });
    } catch (error: any) {
      this.logger.error({
        message: 'Batch deletion process failed',
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Permanently delete a user and all associated data
   */
  private async permanentDeleteUser(userId: string): Promise<void> {
    const session = await this.userModel.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Delete user presence data
        await this.presenceModel.deleteMany(
          { userId: new Types.ObjectId(userId) },
          { session },
        );

        // 2. Anonymize user data for GDPR compliance
        const anonymizedEmail = `deleted_${userId}@deleted.user`;
        const anonymizedPhone = `0000000000`;

        await this.userModel.findByIdAndUpdate(
          userId,
          {
            $set: {
              isDeleted: true,
              deletedAt: new Date(),
              email: anonymizedEmail,
              phoneNumber: anonymizedPhone,
              firstName: '[Deleted]',
              lastName: '[Deleted]',
              profilePicture: null,
              address: null,
              devices: [],
              // Clear all sensitive data
              password: '[DELETED]',
              code: null,
              codeAt: null,
            },
          },
          { session },
        );

        // 3. Emit user deleted event for other services
        this.eventEmitter.emit('user.permanently.deleted', { userId });

        this.logger.log(`User permanently deleted: ${userId}`);
      });

      await session.endSession();
    } catch (error: any) {
      await session.endSession();
      throw error;
    }
  }

  /**
   * Get deactivation status for a user
   */
  async getDeactivationStatus(userId: string): Promise<any> {
    const user = await this.userModel
      .findById(userId)
      .select(
        'isActive isDeleted deactivation scheduledDeletionAt deletionRequestedAt',
      );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      deactivationInfo: user.deactivation || null,
      scheduledDeletionAt: user.scheduledDeletionAt,
      deletionRequestedAt: user.deletionRequestedAt,
      daysUntilDeletion: user.scheduledDeletionAt
        ? Math.ceil(
            (user.scheduledDeletionAt.getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          )
        : null,
    };
  }
}
