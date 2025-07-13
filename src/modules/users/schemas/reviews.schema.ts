import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '@schemas/user.schema';
import { Company } from '@schemas/company.schema';

export type ReviewsDocument = HydratedDocument<Reviews>;

@Schema({ timestamps: true })
export class Reviews {
  @Prop({ required: true })
  description: string;

  @Prop({ required: false, min: 1, max: 5 })
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

  @Prop({ type: Types.ObjectId, ref: 'Company', index: true })
  company: Company;
}

export const ReviewsSchema = SchemaFactory.createForClass(Reviews);

ReviewsSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});
