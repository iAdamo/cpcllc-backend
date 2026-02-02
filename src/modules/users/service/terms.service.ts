import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { model, Model, Types } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import { Terms, TermsDocument } from '@users/schemas/terms.schema';
import { AcceptTermsDto } from '../dto/accept-terms.dto';

export interface TermsCheckResult {
  ok: boolean;
  reason?: 'NOT_ACCEPTED' | 'SESSION_INVALID';
  requiredTerms?: {
    termsType: string;
    version: string;
    effectiveFrom: Date;
  }[];
}

@Injectable()
export class TermsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Terms.name) private termsModel: Model<TermsDocument>,
  ) {}

  async getActiveTerms(termsTypes: string[]) {
    return this.termsModel.find({
      termsType: { $in: termsTypes },
      isActive: true,
    });
  }

  async hasAcceptedLatest(
    userId: string,
    termsTypes: string[],
    tokenIssuedAt?: number,
  ): Promise<TermsCheckResult> {
    const activeTermsList = await this.getActiveTerms(termsTypes);

    if (!activeTermsList || activeTermsList.length === 0) {
      return { ok: true };
    }

    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      return { ok: false, reason: 'NOT_ACCEPTED' };
    }

    if (tokenIssuedAt && user.termsInvalidatedAt) {
      const tokenIssuedAtMs = tokenIssuedAt * 1000;
      const termsInvalidatedAtMs = new Date(user.termsInvalidatedAt).getTime();

      if (tokenIssuedAtMs < termsInvalidatedAtMs) {
        return {
          ok: false,
          reason: 'SESSION_INVALID',
        };
      }
    }

    const missingTerms = activeTermsList.filter((activeTerms) => {
      return !user.termsAcceptances?.some(
        (t) =>
          t.termsId.equals(activeTerms._id) &&
          t.version === activeTerms.version &&
          t.status === 'accepted',
      );
    });

    if (missingTerms.length > 0) {
      return {
        ok: false,
        reason: 'NOT_ACCEPTED',
        requiredTerms: missingTerms.map((t) => ({
          termsType: t.termsType,
          version: t.version,
          effectiveFrom: t.effectiveFrom,
        })),
      };
    }

    return { ok: true };
  }

  async decideLatestTermsBatch(userId: string, dtos: AcceptTermsDto[]) {
    const results = [];

    for (const dto of dtos) {
      const result = await this.decideLatestTerms(userId, dto);
      results.push(result);
    }
    return results;
  }

  async decideLatestTerms(userId: string, dto: AcceptTermsDto) {
    try {
      const activeTerms = await this.termsModel.findOne({
        termsType: dto.termsType,
        isActive: true,
      });

      if (!activeTerms) {
        throw new BadRequestException(`No active ${dto.termsType} terms found`);
      }

      const updateResult = await this.userModel.updateOne(
        {
          _id: userId,
          'termsAcceptances.termsId': activeTerms._id,
          'termsAcceptances.version': activeTerms.version,
        },
        {
          $set: {
            'termsAcceptances.$.status': dto.status,
            'termsAcceptances.$.decidedAt': new Date(),
            'termsAcceptances.$.platform': dto.platform,
          },
        },
      );
      if (updateResult.matchedCount === 0) {
        await this.userModel.updateOne(
          { _id: userId },
          {
            $push: {
              termsAcceptances: {
                termsId: activeTerms._id,
                version: activeTerms.version,
                status: dto.status,
                decidedAt: new Date(),
                platform: dto.platform,
              },
            },
          },
        );
      }

      return {
        status: dto.status,
        termsType: dto.termsType,
        version: activeTerms.version,
      };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
