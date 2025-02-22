import { Module } from '@nestjs/common';
import { Users, UsersSchema } from './schemas/users.schema';
import { Admin, AdminSchema } from '@schemas/admin.schema';
import { Client, ClientSchema } from '@schemas/client.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Users.name,
        schema: UsersSchema,
        discriminators: [
          { name: Admin.name, schema: AdminSchema },
          { name: Client.name, schema: ClientSchema },
          { name: Company.name, schema: CompanySchema },
        ],
      },
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
