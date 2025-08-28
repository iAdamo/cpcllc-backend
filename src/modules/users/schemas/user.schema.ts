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

  @Prop({ required: true, unique: true, match: /^\+?\d{1,15}$/ })
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  profilePicture?: string;

  // residential address
  @Prop({ required: false })
  address?: string;

  // geographical coordinates
  @Prop({ required: false })
  latitude?: number;

  @Prop({ required: false })
  longitude?: number;

  @Prop({ required: false })
  language?: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  isPhoneVerified: boolean;

  @Prop({ default: 0 })
  emailEditCount: number;

  @Prop({ default: 0 })
  phoneEditCount: number;

  @Prop()
  code?: string;

  @Prop()
  codeAt?: Date;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  forgetPassword: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Provider' }], default: [] })
  hiredCompanies: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['Client', 'Provider', 'Admin'],
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
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    delete ret.code;
    delete ret.codeAt;
    delete ret.forgetPassword;
    return ret;
  },
});

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

export function sanitizeUser(user: HydratedDocument<User> | any) {
  if (!user) return null;

  // If it's a Mongoose doc, convert with toJSON (this applies your schema transform)
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : user;

  // Extra safety: remove sensitive fields in case of .lean()
  const { password, __v, code, codeAt, forgetPassword, ...safeUser } = plain;

  return safeUser;
}
