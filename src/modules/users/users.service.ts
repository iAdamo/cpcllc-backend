import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import { Company, CompanyDocument } from '@schemas/company.schema';
import { Admin, AdminDocument } from '@schemas/admin.schema';
import { CreateUserDto } from '@dto/create-user.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateCompanyUserDto } from './dto/update-company.dto';
import { DbStorageService } from '../../utils/dbStorage';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    private readonly dbStorageService: DbStorageService,
  ) {}

  private async uploadFiles(
    userEmail: string,
    files: Express.Multer.File[],
  ): Promise<{ url: string; index: number }[]> {
    return Promise.all(
      files.map(async (file, index) => {
        let url = '';

        if (process.env.STORAGETYPE === 'local') {
          url = await this.dbStorageService.saveFile(userEmail, file);
        } else {
          url = 'cloud-storage-url-placeholder'; // Implement actual cloud storage logic
        }

        return { url, index };
      }),
    );
  }

  /**
   * Create an Users
   * @param createUsersDto Users data
   * @returns
   */
  async createUsers(createUsersDto: CreateUserDto): Promise<User> {
    const { email, password } = createUsersDto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.userModel.findOne({ email });

    if (user) {
      throw new ConflictException('Email already exists');
    }

    return await this.userModel.create(createUsersDto);
  }

  /**
   * Create a Company
   * @param createCompanyDto Company data
   * @param id User id
   * @returns
   */
  async createCompany(
    id: string,
    createCompanyDto: CreateCompanyDto,
    files: Express.Multer.File[],
  ): Promise<Company> {
    if (!id) {
      throw new BadRequestException('User id is required');
    }
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mediaEntries = await this.uploadFiles(user.email, files);

    const company = await this.companyModel.create({
      ...createCompanyDto,
      owner: id,
      companyLogo: mediaEntries[0]?.url,
    });

    user.activeRole = 'Company';

    user.activeRoleId = company._id;

    await user.save();

    return company;
  }

  /**
   * Create an Admin
   * @param createAdminDto Admin data
   * @param id User id
   * @returns
   */
  async createAdmin(
    id: string,
    createAdminDto: CreateAdminDto,
  ): Promise<Admin> {
    if (!id) {
      throw new BadRequestException('User id is required');
    }

    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const admin = await this.adminModel.create({
      ...createAdminDto,
      user: id,
    });

    user.activeRole = 'Admin';

    user.activeRoleId = admin._id;

    await user.save();

    return admin;
  }
}
