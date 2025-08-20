import { Module, forwardRef } from '@nestjs/common';
import { User, UserSchema } from '@schemas/user.schema';
// import { Admin, AdminSchema } from 'src/modules/admin/schemas/admin.schema';
import {
  Company,
  CompanySchema,
} from 'src/modules/company/schemas/company.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesModule } from '@modules/services.module';
import { CompanyModule } from '@modules/company.module';
import { AdminModule } from '../admin/admin.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    forwardRef(() => CompanyModule),
    forwardRef(() => ServicesModule),
    forwardRef(() => AdminModule),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
