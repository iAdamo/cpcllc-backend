import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '@modules/users.module';
import { ServicesService } from '@controllers/services.service';
import { ServicesController } from '@services/services.controller';
import { CacheModule } from '@modules/cache.module';
import {
  Subcategory,
  Category,
  Service,
  ServiceSchema,
  CategorySchema,
  SubcategorySchema,
} from '@schemas/service.schema';
import { ProviderSchema, Provider } from '@schemas/provider.schema';
import { JobPostSchema, JobPost } from '@schemas/job.schema';
import { ProposalSchema, Proposal } from '@schemas/proposal.schema';
import { DbStorageService } from 'src/common/utils/dbStorage';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => CacheModule),
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: JobPost.name, schema: JobPostSchema },
      { name: Proposal.name, schema: ProposalSchema },
    ]),
  ],

  providers: [ServicesService, DbStorageService],
  controllers: [ServicesController],
  exports: [MongooseModule],
})
export class ServicesModule {}
