import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type AdminDocument = HydratedDocument<Admin>;

@Schema()
export class Admin {
  role: string;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
