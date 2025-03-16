import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

@Schema()
export class Company {
  @Prop({ required: true })
  role: string;

  @Prop({ required: false })
  companyName: string;

  @Prop({ required: false })
  companyDescription: string;

  @Prop({ required: false })
  companyEmail: string;

  @Prop({ required: false })
  companyPhoneNumber: string;

  @Prop({ required: false })
  companyAddress: string;

  @Prop({ required: false })
  companyLogo: string;

  @Prop({ required: false })
  zip: string;

  @Prop({ required: false })
  city: string;

  @Prop({ required: false })
  latitude: number;

  @Prop({ required: false })
  longitude: number;

  @Prop({ required: false })
  state: string;

  @Prop({ required: false })
  country: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }] })
  services: Types.ObjectId[];
}

export const CompanySchema = SchemaFactory.createForClass(Company);
