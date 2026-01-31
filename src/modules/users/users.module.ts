import { Module, forwardRef } from '@nestjs/common';
import { User, UserSchema } from '@schemas/user.schema';
// import { Admin, AdminSchema } from 'src/modules/admin/schemas/admin.schema';
import { Terms, TermsSchema } from './schemas/terms.schema';
import {
  Provider,
  ProviderSchema,
} from 'src/modules/provider/schemas/provider.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ServicesModule } from '@modules/services.module';
import { ProviderModule } from 'src/modules/provider/provider.module';
import { AdminModule } from '../admin/admin.module';
import { UsersService } from './service/users.service';
import { UsersController } from './controller/users.controller';
import { TermsService } from './service/terms.service';
import { TermsController } from './controller/terms.controller';
import { CacheModule } from '@modules/cache.module';
import { DbStorageService } from 'src/common/utils/dbStorage';

@Module({
  imports: [
    forwardRef(() => ProviderModule),
    forwardRef(() => ServicesModule),
    forwardRef(() => AdminModule),
    CacheModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Provider.name, schema: ProviderSchema },
      { name: Terms.name, schema: TermsSchema },
    ]),
  ],
  providers: [UsersService, DbStorageService, TermsService],
  controllers: [UsersController, TermsController],
  exports: [UsersService, MongooseModule, TermsService],
})
export class UsersModule {}
