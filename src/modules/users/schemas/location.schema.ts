import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LocationDocument = HydratedDocument<Location>;

@Schema()
export class Coordinates {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  long: number;
}

@Schema()
export class Address {
  @Prop({ required: true })
  zip: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  address: string;
}

@Schema()
export class Location {
  @Prop({ type: Coordinates, required: true })
  coordinates: Coordinates;

  @Prop({ type: Address, required: true })
  address: Address;
}

export const LocationSchema = SchemaFactory.createForClass(Location);
export const CoordinatesSchema = SchemaFactory.createForClass(Coordinates);
export const AddressSchema = SchemaFactory.createForClass(Address);
