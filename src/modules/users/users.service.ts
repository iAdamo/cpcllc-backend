import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Users } from '@schemas/users.schema';
import { CreateUsersDto } from '@modules/dto/create-users.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(Users.name) private userModel: Model<Users>) {}

  /**
   * Create an Users
   * @param createUsersDto Users data
   * @returns
   */
  async createUsers(createUsersDto: CreateUsersDto): Promise<Users> {
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
}
