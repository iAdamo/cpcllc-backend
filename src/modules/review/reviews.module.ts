import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Reviews, ReviewsSchema } from '@services/schemas/reviews.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '@modules/users.module';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reviews.name, schema: ReviewsSchema }]),
    UsersModule,
  ],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [MongooseModule],
})
export class ReviewsModule {}
