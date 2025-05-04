import { Module } from '@nestjs/common';
import { ServicesService } from './services/services.service';
import { ReviewsService } from './services/reviews.service';
import { ServicesController } from './controllers/services.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Services, ServicesSchema } from '@schemas/services.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { Reviews, ReviewsSchema } from './schemas/reviews.schema';
import { DbStorageService } from '../../utils/dbStorage';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Services.name, schema: ServicesSchema },
      { name: Reviews.name, schema: ReviewsSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  providers: [ServicesService, DbStorageService, ReviewsService],
  controllers: [ServicesController],
  exports: [ServicesService, MongooseModule],
})
export class ServicesModule {}
