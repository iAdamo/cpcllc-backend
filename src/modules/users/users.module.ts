import { Module } from '@nestjs/common';
import { Admin, AdminSchema } from '@schemas/admin.schema';
import { Client, ClientSchema } from '@schemas/client.schema';
import { Company, CompanySchema } from '@schemas/company.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
    imports: [
        MongooseModule.forFeature([
        { name: Admin.name, schema: AdminSchema },
        { name: Client.name, schema: ClientSchema },
        { name: Company.name, schema: CompanySchema },
        ]),
    ],
    providers: [UsersService],
    controllers: [UsersController],
})
export class UsersModule {}
