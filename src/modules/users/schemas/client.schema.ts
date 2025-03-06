import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClientDocument = HydratedDocument<Client>;

@Schema()
export class Client {
  role: string;

  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }] })
  purchasedServices: Types.ObjectId[];
}

export const ClientSchema = SchemaFactory.createForClass(Client);
