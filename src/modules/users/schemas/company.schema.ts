import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Location, LocationSchema } from '@schemas/location.schema';
import { Reviews } from '@schemas/reviews.schema';

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ timestamps: true })
export class Company {
  @Prop({ required: true })
  companyName: string;

  @Prop({ required: false })
  companyDescription: string;

  @Prop({ required: false })
  companyEmail: string;

  @Prop({ required: false })
  companyPhoneNumber: string;

  @Prop({ type: [String], required: false })
  companyImages: string[];

  @Prop({
    type: [String],
    required: true,
    index: true,
    default: [],
  })
  selectedServices: string[];

  @Prop({
    type: {
      primary: { type: LocationSchema, required: true },
      secondary: { type: LocationSchema, required: false },
      tertiary: { type: LocationSchema, required: false },
    },
  })
  location: {
    primary: Location;
    secondary?: Location;
    tertiary?: Location;
  };

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true,
    index: true,
  })
  owner: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  clients: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Services' }] })
  services: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  favoritedBy: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Reviews' }], default: [] })
  reviews: Reviews[];

  @Prop({ default: 0 })
  favoriteCount: number;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.set('toJSON', {
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
