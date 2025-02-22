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
import { CreateAdminDto } from '@dto/create-admin.dto';
import { CreateClientDto } from '@dto/create-client.dto';
import { CreateCompanyDto } from '@dto/create-company.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('admin')
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.usersService.createAdmin(createAdminDto);
  }

  @Post('client')
  async createClient(@Body() createClientDto: CreateClientDto) {
    return this.usersService.createClient(createClientDto);
  }

  @Post('company')
  async createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    return this.usersService.createCompany(createCompanyDto);
  }
}
