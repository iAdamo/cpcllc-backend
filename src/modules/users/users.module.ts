import { Module } from '@nestjs/common';
import { User, UserSchema } from '@schemas/user.schema';
import { Admin, AdminSchema } from '@schemas/admin.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DbStorageService } from '../../utils/dbStorage';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  providers: [UsersService, DbStorageService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
