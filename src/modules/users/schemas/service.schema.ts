import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;


@Schema({ timestamps: true })
export class Service {}

export const ServiceSchema = SchemaFactory.createForClass(Service);
