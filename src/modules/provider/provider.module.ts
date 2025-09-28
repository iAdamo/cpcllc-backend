import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import { ProviderService } from './provider.service';
import { ProviderController } from './provider.controller';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { DbStorageService } from 'src/utils/dbStorage';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AdminModule),
    MongooseModule.forFeature([
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],
  providers: [ProviderService, DbStorageService],
  controllers: [ProviderController],
  exports: [ProviderService, MongooseModule],
})
export class ProviderModule {}
