import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Provider, ProviderSchema } from './schemas/provider.schema';
import { UserSchema, User } from '@modules/schemas/user.schema';
import { ProviderService } from './provider.service';
import { ProviderController } from './provider.controller';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';
import { DbStorageService } from 'src/common/utils/dbStorage';
import { CacheModule } from '@cache/cache.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AdminModule),
    forwardRef(() => CacheModule),
    MongooseModule.forFeature([
      { name: Provider.name, schema: ProviderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ProviderService, DbStorageService],
  controllers: [ProviderController],
  exports: [ProviderService, MongooseModule],
})
export class ProviderModule {}
