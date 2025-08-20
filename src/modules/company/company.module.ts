import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Company, CompanySchema } from './schemas/company.schema';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '@services/services.module';
import { AdminModule } from '../admin/admin.module';


@Module({
  imports: [
    forwardRef(() => UsersModule),
    ServicesModule,
    AdminModule,
    MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }]),
  ],
  providers: [CompanyService],
  controllers: [CompanyController],
  exports: [CompanyService, MongooseModule],
})
export class CompanyModule {}
