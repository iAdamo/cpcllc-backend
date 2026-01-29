import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { TermsAcceptance, TermsAcceptanceSchema } from './terms.schema';

export type UserDocument = HydratedDocument<User>;

@Schema({ _id: false })
export class ProfilePicture {
  @Prop()
  type?: string;

  @Prop()
  url?: string;

  @Prop()
  thumbnail?: string;

  @Prop()
  index?: number;
}

export const ProfilePictureSchema =
  SchemaFactory.createForClass(ProfilePicture);

class Device {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  pushToken: string;

  @Prop()
  lastSeen: Date;

  @Prop()
  publicKey: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({
    required: true,
    unique: true,
    match: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  })
  email: string;

  @Prop({ required: true, unique: true, match: /^\+?\d{6,15}$/ })
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: ProfilePictureSchema, default: null })
  profilePicture?: ProfilePicture | null;

  // residential address
  @Prop({ required: false })
  address?: string;

  // following count
  @Prop({ default: 0 })
  followingCount: number;

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

  @Prop({ default: 0 })
  reviewCount: number;

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ sparse: true, index: true })
  code?: string;

  @Prop()
  codeAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  forgetPassword: boolean;

  @Prop({ required: false })
  status: string;

  @Prop({ type: [Device], default: [] })
  devices: Device[];

  @Prop({
    type: [TermsAcceptanceSchema],
    default: [],
  })
  termsAcceptances: TermsAcceptance[];

  @Prop({ type: Date })
  termsInvalidatedAt?: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Provider' }], default: [] })
  hiredCompanies: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['Client', 'Provider', 'Admin'],
    default: 'Client',
  })
  activeRole: 'Client' | 'Provider' | 'Admin';

  @Prop({ type: Types.ObjectId, refPath: 'activeRole', index: true })
  activeRoleId: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Provider' }], default: [] })
  followedProviders: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Reviews' }], default: [] })
  reviews: Types.ObjectId[];

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
