import { Module } from '@nestjs/common';
import { ServicesService } from './services/services.service';
import { ServicesController } from './controllers/services.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Services, ServicesSchema } from '@schemas/services.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { Reviews, ReviewsSchema } from '../users/schemas/reviews.schema';
import { DbStorageService } from '../../utils/dbStorage';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Services.name, schema: ServicesSchema },
      { name: Reviews.name, schema: ReviewsSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
    CacheModule.register({
      isGlobal: true,
      store: 'memory',
      max: 100,
      ttl: 60, // seconds
    }),
  ],
  providers: [ServicesService, DbStorageService],
  controllers: [ServicesController],
  exports: [ServicesService, MongooseModule],
})
export class ServicesModule {}
