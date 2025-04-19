import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
// import { Location, LocationSchema } from '@schemas/location.schema';

export type ServicesDocument = HydratedDocument<Services>;

@Schema({ timestamps: true })
export class Services {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  category: string;

  @Prop({ required: false, default: 0 })
  ratings: number;

  @Prop({ required: true })
  location: string;

  @Prop({
    type: {
      image: {
        primary: { type: String, required: true },
        secondary: { type: String, required: false },
        tertiary: { type: String, required: false },
      },
      video: {
        primary: { type: String, required: false },
        secondary: { type: String, required: false },
        tertiary: { type: String, required: false },
      },
    },
    required: true,
  })
  media: {
    image: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    video: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
  };

  @Prop({ required: true, type: Types.ObjectId, ref: 'Company' })
  company: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  clients: Types.ObjectId[];
}

export const ServicesSchema = SchemaFactory.createForClass(Services);

ServicesSchema.index({ category: 1 });
ServicesSchema.index({ company: 1 });
ServicesSchema.index({ clients: 1 });
ServicesSchema.index({ 'location.primary': '2dsphere' });
ServicesSchema.index({ 'location.secondary': '2dsphere' });
ServicesSchema.index({ 'location.tertiary': '2dsphere' });
