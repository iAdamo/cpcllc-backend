import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClientDocument = HydratedDocument<Client>;

@Schema()
export class Client {
  @Prop({ required: true })
  role: string;

  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({ required: false })
  clientName: string;

  @Prop({ required: false })
  clientDescription: string;

  @Prop({ required: false })
  clientEmail: string;

  @Prop({ required: false })
  clientPhoneNumber: string;

  @Prop({ required: false })
  clientAddress: string;

  @Prop({ required: false })
  clientLogo: string;

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
  purchasedServices: Types.ObjectId[];
}

export const ClientSchema = SchemaFactory.createForClass(Client);
