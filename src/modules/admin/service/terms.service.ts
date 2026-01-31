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
import { Admin, AdminDocument } from 'src/modules/admin/schemas/admin.schema';
import { CreateAdminDto } from '@dto/create-admin.dto';
import { UpdateAdminDto } from '@dto/update-admin.dto';
import { CreateUserDto } from '@dto/create-user.dto';
import { DbStorageService } from 'src/common/utils/dbStorage';
import { Terms, TermsDocument } from '@users/schemas/terms.schema';
import { PublishTermsDto } from '@admin/dto/create-terms.dto';

@Injectable()
export class AdminTermsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    @InjectModel(Admin.name) private termsModel: Model<TermsDocument>,
    private readonly storage: DbStorageService,
  ) {}

  private readonly ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    EMAIL_REQUIRED: 'Email and password are required',
    EMAIL_EXISTS: 'Email already exists',
    USER_ID_REQUIRED: 'User id is required',
    FILE_UPLOAD_FAILED: 'File upload failed',
  };

  async publishNewTerms(dto: PublishTermsDto) {
    // 1️⃣ Deactivate old terms of this type
    await this.termsModel.updateMany(
      { termsType: dto.termsType, isActive: true },
      { isActive: false },
    );

    // 2️⃣ Create new active terms
    const newTerms = await this.termsModel.create({
      ...dto,
      isActive: true,
      effectiveFrom: new Date(),
    });

    // 3️⃣ Invalidate user sessions
    await this.userModel.updateMany({}, { termsInvalidatedAt: new Date() });

    return newTerms;
  }
}
