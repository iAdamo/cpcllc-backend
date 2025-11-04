import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProfilePicture } from '@modules/schemas/user.schema';

export type CategoryDocument = HydratedDocument<Category>;
export type SubcategoryDocument = HydratedDocument<Subcategory>;
export type JobPostDocument = HydratedDocument<JobPost>;

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
  categoryId: Types.ObjectId; // Reference to the parent category
}

@Schema({ timestamps: true })
export class JobPost {
  /** Reference to the client who created the job */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  /** Optional: Provider assigned or accepted for the job */
  @Prop({ type: Types.ObjectId, ref: 'Provider', default: null })
  providerId?: Types.ObjectId;

  /** Job category/subcategory references */
  @Prop({
    type: Types.ObjectId,
    ref: 'Subcategory',
    required: true,
    index: true,
  })
  subcategoryId: Types.ObjectId;

  /** Core details */
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  description: string;

  /** Budget (single or range) */
  @Prop({ required: true, min: 0 })
  budget: number;

  @Prop({ default: false })
  negotiable: boolean;

  /** Deadline / timeline */
  @Prop({ type: Date, default: null })
  deadline?: Date;

  /** Location info */
  @Prop({ type: String, default: null })
  location?: string;

  @Prop({
    type: {
      lat: { type: Number },
      long: { type: Number },
    },
    default: null,
  })
  coordinates?: { lat: number; long: number };

  /** Urgency: 'normal' | 'urgent' | 'immediate' */
  @Prop({
    type: String,
    enum: ['Normal', 'Urgent', 'Immediate'],
    default: 'Normal',
  })
  urgency?: string;

  /** Visibility: public or only verified providers */
  @Prop({
    type: String,
    enum: ['Public', 'Verified', 'Private'],
    default: 'Public',
  })
  visibility?: string;

  /** Contact preferences */
  @Prop({
    type: [String],
    enum: ['chat', 'call', 'both'],
    default: ['chat'],
  })
  contactPreference?: string[];

  /** Media attachments (images/videos) */
  @Prop({ default: [] })
  media: ProfilePicture[];

  /** Tags or keywords */
  @Prop({ type: [String], default: [] })
  tags?: string[];

  /** Active / status states */
  @Prop({
    type: String,
    enum: ['active', 'in_progress', 'completed', 'cancelled', 'expired'],
    default: 'active',
    index: true,
  })
  status: string;

  /** Optional: allow anonymous posting */
  @Prop({ default: false })
  anonymous: boolean;

  /** Internal flags */
  @Prop({ default: true })
  isActive: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
export const SubcategorySchema = SchemaFactory.createForClass(Subcategory);
export const JobPostSchema = SchemaFactory.createForClass(JobPost);
