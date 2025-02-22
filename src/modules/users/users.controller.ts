import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from '@services/users.service';
import { CreateUsersDto } from '@modules/dto/create-users.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('')
  async createAdmin(@Body() createUsersDto: CreateUsersDto) {
    return this.usersService.createUsers(createUsersDto);
  }
}
