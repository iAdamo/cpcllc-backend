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
import { DbStorageService } from 'src/utils/dbStorage';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
  ) {}

  private readonly storage = new DbStorageService();

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
      .populate('hiredCompanies')
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
    if (files && files.length > 0) {
      try {
        const uploadedFiles = await this.storage.handleFileUpload(
          admin.user.toString(),
          files,
        );
        updateAdminDto.profilePicture =
          uploadedFiles[0]?.url || admin.profilePicture;
      } catch (error) {
        throw new InternalServerErrorException(
          this.ERROR_MESSAGES.FILE_UPLOAD_FAILED,
        );
      }
    }
    const updatedAdmin = await this.adminModel
      .findByIdAndUpdate(id, updateAdminDto, { new: true, runValidators: true })
      .populate('user', 'email name profilePicture')
      .exec();
    return updatedAdmin;
  }
}
