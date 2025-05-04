import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '@schemas/user.schema';
import { Services } from '@schemas/services.schema';
import { Company } from '@schemas/company.schema';

export type ReviewsDocument = HydratedDocument<Reviews>;

@Schema({ timestamps: true })
export class Reviews {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop([String])
  images: string[];

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  helpfulVotes: Types.ObjectId[];

  @Prop()
  companyReply: string;

  @Prop([String])
  tags: string[];

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ type: Types.ObjectId, ref: 'Company' })
  company: Company;

  @Prop({ type: Types.ObjectId, ref: 'Services' })
  service: Services;
}

export const ReviewsSchema = SchemaFactory.createForClass(Reviews);
