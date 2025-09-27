// src/modules/provider/schemas/provider.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Location, LocationSchema } from './location.schema';

import { SchemaTypes } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

@Schema({ timestamps: true })
export class Provider {
  @Prop({ required: true, unique: true, index: true })
  providerName: string;

  @Prop({ required: false })
  providerDescription: string;

  @Prop({ required: false })
  providerEmail: string;

  @Prop({
    required: false,
    match: /^\+?[1-9]\d{1,14}$/,
    unique: true,
    index: true,
  })
  providerPhoneNumber: string;

  @Prop({ required: false })
  providerLogo: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: [String], required: false })
  providerImages: string[];

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  providerSocialMedia: Record<string, string>;

  @Prop({ default: 0 })
  followersCount: number;

  @Prop({ default: 0 })
  reviewCount: number;

  @Prop({ default: 0 })
  favoriteCount: number;

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  categories: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Subcategory' }], default: [] })
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
  reviews: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  followedBy: Types.ObjectId[];
}

export const ProviderSchema = SchemaFactory.createForClass(Provider);

ProviderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.reviews;
    return ret;
  },
});
