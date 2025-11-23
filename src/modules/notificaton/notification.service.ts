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

  async getPresence(userId: string): Promise<Date | null> {
    const presence = await this.presenceModel.findOne({ userId });
    return presence?.lastSeen || null;
  }
}
