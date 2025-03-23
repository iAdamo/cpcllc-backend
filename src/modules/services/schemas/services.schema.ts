import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServicesDocument = HydratedDocument<Services>;

@Schema({ timestamps: true })
export class Services {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  category: string;
  
  @Prop({ type: [String], required: true })
  pictures: string[];

  @Prop({ required: true, type: Types.ObjectId, ref: 'Company' })
  company: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Client' }] })
  clients: Types.ObjectId[];
}

export const ServicesSchema = SchemaFactory.createForClass(Services);

ServicesSchema.index({ category: 1 });
ServicesSchema.index({ company: 1 });
ServicesSchema.index({ clients: 1 });
