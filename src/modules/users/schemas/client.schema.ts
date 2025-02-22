import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type ClientDocument = HydratedDocument<Client>;

@Schema()
export class Client {
  @Prop({
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  comparePassword: (password: string) => Promise<boolean>;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
