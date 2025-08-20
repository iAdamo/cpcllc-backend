import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './schemas/admin.schema';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
    imports: [
        forwardRef(() => UsersModule),
        MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    ],
    providers: [AdminService],
    controllers: [AdminController],
    exports: [AdminService, MongooseModule],
})
export class AdminModule {}
