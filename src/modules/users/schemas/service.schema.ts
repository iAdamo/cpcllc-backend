import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;
export type SubcategoryDocument = HydratedDocument<Subcategory>;
export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name: string; // e.g. "Snow Removal"

  @Prop()
  description?: string;
}

@Schema({ timestamps: true })
export class Subcategory {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category: Types.ObjectId;
  // Reference to the parent category
}

@Schema({ timestamps: true })
export class Service {
  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  company: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceCategory', required: true })
  category: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  images?: string[];

  @Prop({ type: [String], default: [] })
  videos?: string[];
}

export const CategorySchema = SchemaFactory.createForClass(Category);
export const SubcategorySchema = SchemaFactory.createForClass(Subcategory);
export const ServiceSchema = SchemaFactory.createForClass(Service);
