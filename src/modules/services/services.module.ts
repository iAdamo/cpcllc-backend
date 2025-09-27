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
} from '@modules/schemas/service.schema';
import { ProviderModule } from '@modules/provider.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => CacheModule),
    forwardRef(() => ProviderModule),
    MongooseModule.forFeature([
      { name: Service.name, schema: ServiceSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
    ]),
  ],

  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [MongooseModule],
})
export class ServicesModule {}
