import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Presence, PresenceDocument } from '@schemas/presence.schema';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Presence.name) private presenceModel: Model<PresenceDocument>,
  ) {}

  async updateLastSeen(userId: string, lastSeen: Date) {
    await this.presenceModel.updateOne(
      { userId },
      { $set: { isOnline: false, lastSeen } },
      { upsert: true },
    );
  }

  async getPresence(userId: string): Promise<Presence> {
    return await this.presenceModel.findOne({ userId });
  }

  async updateAvailability(userId: string, status: string): Promise<Presence> {
    if (!userId) {
      throw new BadRequestException(
        'userId is required to update availability',
      );
    }

    const normalized = (status || '').trim().toLowerCase();

    // Allowed statuses
    const allowedStatuses = ['available', 'offline', 'busy', 'away'];
    if (!allowedStatuses.includes(normalized)) {
      throw new BadRequestException(`Invalid availability status: ${status}`);
    }

    // Online if NOT offline
    const isOnline = normalized !== 'offline';

    const update: any = {
      isOnline,
      availability: normalized, // store lowercase consistently
    };

    if (!isOnline) {
      update.lastSeen = new Date();
    }

    const updated = await this.presenceModel.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: true, lean: true },
    );

    return updated;
  }
}
