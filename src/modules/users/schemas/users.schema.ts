import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Admin } from './admin.schema';
import { Client } from './client.schema';
import { Company } from './company.schema';

export type UsersDocument = HydratedDocument<Users>;

@Schema({ discriminatorKey: 'role', timestamps: true })
export class Users {
  @Prop({
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    required: true,
    enum: [Admin.name, Client.name, Company.name],
    default: Client.name,
  })
  role: string;

  @Prop()
  code: string;

  @Prop()
  codeAt: Date;

  @Prop({ default: false })
  verified: boolean;

  @Prop({ default: false })
  forgetPassword: boolean;

  comparePassword: (password: string) => Promise<boolean>;
}

export const UsersSchema = SchemaFactory.createForClass(Users);

// Hash the password before saving
UsersSchema.pre<UsersDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Add a method to compare passwords
UsersSchema.methods.comparePassword = async function (
  UsersPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(UsersPassword, this.password);
};


// Remove sensitive fields before sending to the client
UsersSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.createdAt;
    delete ret.updatedAt;
    delete ret.code;
    delete ret.codeAt;
    delete ret.verified;
    delete ret.forgetPassword;
    return ret;
  },
});