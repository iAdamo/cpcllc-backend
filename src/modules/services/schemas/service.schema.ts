import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;
export type SubcategoryDocument = HydratedDocument<Subcategory>;
export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Subcategory' }], default: [] })
  subcategories: Types.ObjectId[];
}

@Schema({ timestamps: true })
export class Subcategory {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;
  // Reference to the parent category
}

@Schema({ timestamps: true })
export class Service {
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true })
  providerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Subcategory' }],
    required: true,
  })
  subcategoryId: Types.ObjectId[];

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  // pricing range
  @Prop({ required: true })
  price: string;

  @Prop({ required: true, default: 0 })
  duration: number;

  @Prop({ default: null })
  location?: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  media?: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const CategorySchema = SchemaFactory.createForClass(Category);
export const SubcategorySchema = SchemaFactory.createForClass(Subcategory);
export const ServiceSchema = SchemaFactory.createForClass(Service);
