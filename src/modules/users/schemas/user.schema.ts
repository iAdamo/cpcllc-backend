import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({
    required: true,
    unique: true,
    match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  profilePicture?: string;

  @Prop()
  code?: string;

  @Prop()
  codeAt?: Date;

  @Prop({ default: false })
  verified: boolean;

  @Prop({ default: false })
  forgetPassword: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Service' }] })
  purchasedServices: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Company' }], default: [] })
  hiredCompanies: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Admin' }], default: [] })
  admins: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['Client', 'Company', 'Admin'],
    default: 'Client',
  })
  activeRole: string;

  @Prop({ type: Types.ObjectId, refPath: 'activeRole', index: true })
  activeRoleId: Types.ObjectId;

  async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (
  UsersPassword: string,
): Promise<boolean> {
  return bcrypt.compare(UsersPassword, this.password);
};

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.code;
    delete ret.codeAt;
    delete ret.verified;
    delete ret.forgetPassword;
    delete ret.updatedAt;
    return ret;
  },
});
