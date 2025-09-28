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

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => CacheModule),
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],

  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [MongooseModule],
})
export class ServicesModule {}
