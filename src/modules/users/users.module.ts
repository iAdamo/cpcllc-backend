import { Module } from '@nestjs/common';
import { User, UserSchema } from '@schemas/user.schema';
import { Admin, AdminSchema } from '@schemas/admin.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { Reviews, ReviewsSchema } from '@schemas/reviews.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './services/users.service';
import { ReviewsService } from './services/reviews.service';
import { UsersController } from './controllers/users.controller';
import { ReviewsController } from './controllers/reviews.controller';
import { DbStorageService } from '../../utils/dbStorage';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Reviews.name, schema: ReviewsSchema },
    ]),
  ],
  providers: [UsersService, DbStorageService, ReviewsService],
  controllers: [UsersController, ReviewsController],
  exports: [UsersService, MongooseModule],
})

export class UsersModule {}
