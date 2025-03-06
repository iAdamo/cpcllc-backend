import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

@Schema()
export class Company {
  role: string;

  @Prop({ required: false })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }] })
  services: Types.ObjectId[];
}

export const CompanySchema = SchemaFactory.createForClass(Company);
