// src/modules/provider/schemas/provider.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Location, LocationSchema } from './location.schema';
import { ProfilePicture } from '@modules/schemas/user.schema';

import { SchemaTypes } from 'mongoose';

export type ProviderDocument = HydratedDocument<Provider>;

@Schema()
export class ProviderImage {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: false })
  thumbnail?: string;

  @Prop()
  index?: number;
}
export const ProviderImageSchema = SchemaFactory.createForClass(ProviderImage);

@Schema({ timestamps: true })
export class Provider {
  @Prop({ required: true, unique: true, index: true })
  providerName: string;

  @Prop({ required: false })
  providerDescription: string;

  @Prop({ required: false, unique: true })
  providerEmail: string;

  @Prop({
    required: false,
    match: /^\+?[1-9]\d{1,14}$/,
    unique: true,
    index: true,
  })
  providerPhoneNumber: string;

  @Prop({ required: false })
  providerLogo: ProfilePicture;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: [ProviderImageSchema], default: [] })
  providerImages: ProviderImage[];

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  providerSocialMedia: Record<string, string>;

  @Prop({ default: 0 })
  followersCount: number;

  @Prop({ default: 0 })
  reviewCount: number;

  @Prop({ default: true })
  isLiveTrackable: boolean;

  @Prop({ default: true })
  isBookable: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

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

ProviderSchema.index({
  'location.primary.coordinates': '2dsphere',
});

ProviderSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.reviews;
    return ret;
  },
});
