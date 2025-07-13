import { Module } from '@nestjs/common';
import { User, UserSchema } from '@schemas/user.schema';
import { Admin, AdminSchema } from '@schemas/admin.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { Reviews, ReviewsSchema } from '@schemas/reviews.schema';
import {
  Subcategory,
  Category,
  Service,
  ServiceSchema,
  CategorySchema,
  SubcategorySchema,
} from '@schemas/service.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './services/users.service';
import { ReviewsService } from './services/reviews.service';
import { ServicesService } from './services/services.service';
import { UsersController } from './controllers/users.controller';
import { ReviewsController } from './controllers/reviews.controller';
import { ServicesController } from './controllers/services.controller';
import { DbStorageService } from '../../utils/dbStorage';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Reviews.name, schema: ReviewsSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
    ]),
  ],
  providers: [UsersService, DbStorageService, ReviewsService, ServicesService],
  controllers: [UsersController, ReviewsController, ServicesController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
