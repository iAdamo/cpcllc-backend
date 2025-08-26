import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Location, LocationSchema } from 'src/modules/provider/schemas/location.schema';
import { Reviews } from '@schemas/reviews.schema';

export type ProviderDocument = HydratedDocument<Provider>;

@Schema({ timestamps: true })
export class Provider {
  @Prop({ required: true })
  providerName: string;

  @Prop({ required: false })
  providerDescription: string;

  @Prop({ required: false })
  providerEmail: string;

  @Prop({ required: false })
  providerPhoneNumber: string;

  @Prop({ type: [String], required: false })
  providerImages: string[];

  @Prop({ required: false })
  providerWebsite: string;

  @Prop({
    type: Map,
    of: String,
    _id: false,
  })
  providerSocialMedia: Map<string, string>;

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

export const ProviderSchema = SchemaFactory.createForClass(Provider);

ProviderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.reviews;
    return ret;
  },
});
