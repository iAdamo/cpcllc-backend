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

  @Prop({ required: false })
  companyWebsite: string;

  @Prop({
    type: Map,
    of: String,
    _id: false,
  })
  companySocialMedia: Map<string, string>;

  @Prop({ default: 0 })
  reviewCount: number;

  @Prop({ default: 0 })
  favoriteCount: number;

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({
    type: [Types.ObjectId],
    ref: 'Subcategory',
    index: true,
    default: [],
  })
  subcategories: Types.ObjectId[];

  @Prop({
    type: {
      primary: { type: LocationSchema, required: false },
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

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  favoritedBy: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Reviews' }], default: [] })
  reviews: Reviews[];
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.reviews;
    delete ret.updatedAt;
    return ret;
  },
});
