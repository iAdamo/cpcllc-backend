import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';


export type CompanyDocument = HydratedDocument<Company>;

@Schema()
export class Company {
  @Prop({
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  role: string;

  comparePassword: (password: string) => Promise<boolean>;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

// Hash the password before saving
CompanySchema.pre<CompanyDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Add a method to compare passwords
CompanySchema.methods.comparePassword = async function (
  CompanyPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(CompanyPassword, this.password);
};
