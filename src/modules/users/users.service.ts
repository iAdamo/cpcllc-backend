import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin } from '@schemas/admin.schema';
import { Client } from '@schemas/client.schema';
import { Company } from '@schemas/company.schema';
import { CreateAdminDto } from '@dto/create-admin.dto';
import { CreateClientDto } from '@dto/create-client.dto';
import { CreateCompanyDto } from '@dto/create-company.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Client.name) private clientModel: Model<Client>,
    @InjectModel(Company.name) private companyModel: Model<Company>,
  ) {}

  /**
   * Create an Admin
   * @param createAdminDto Admin data
   * @returns
   */
  async createAdmin(createAdminDto: CreateAdminDto): Promise<Admin> {
    const { email, password } = createAdminDto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const admin = await this.adminModel.findOne({ email });

    if (admin) {
      throw new ConflictException('Email already exists');
    }

    return await this.adminModel.create(createAdminDto);
  }

  /**
   * Create a Client
   * @param createClientDto Client data
   * @returns
   */
  async createClient(createClientDto: CreateClientDto): Promise<Client> {
    const { email, password } = createClientDto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const client = await this.clientModel.findOne({ email });

    if (client) {
      throw new ConflictException('Email already exists');
    }

    return await this.clientModel.create(createClientDto);
  }

  /**
   * Create company
   * @param createCompanyDto Company data
   * @returns
   */
  async createCompany(createCompanyDto: CreateCompanyDto): Promise<Company> {
    const { email, password } = createCompanyDto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const company = await this.companyModel.findOne({ email });

    if (company) {
      throw new ConflictException('Email already exists');
    }

    return await this.companyModel.create(createCompanyDto);
  }
}
