import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LocationDocument = HydratedDocument<Location>;

@Schema({ _id: false })
export class Coordinates {
  @Prop({
    type: String,
    enum: ['Point'],
    default: 'Point',
  })
  type: string;

  @Prop({ index: '2dsphere', type: [Number], required: true })
  coordinates: number[];
}
@Schema({ _id: false })
export class Address {
  @Prop({ required: false })
  zip: string;

  @Prop({ required: false })
  city: string;

  @Prop({ required: false })
  country: string;

  @Prop({ required: false })
  address: string;
}

export const CoordinatesSchema = SchemaFactory.createForClass(Coordinates);
export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ _id: false })
export class Location {
  @Prop({ type: CoordinatesSchema, required: true })
  coordinates: Coordinates;

  @Prop({ type: AddressSchema, required: false })
  address?: Address;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

AddressSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});

CoordinatesSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret._id;
    return ret;
  },
});
