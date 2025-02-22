import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';


export type CompanyDocument = HydratedDocument<Company>;

@Schema()
export class Company {
  role: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
