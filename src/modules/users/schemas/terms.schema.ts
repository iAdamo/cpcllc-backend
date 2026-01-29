import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TermsDocument = Terms & Document;

@Schema({ timestamps: true })
export class Terms {
  @Prop({ type: String,
    enum: ['general', 'privacy', 'payments'],
    default: 'Client',
  required: true })
  termsType: string;

  @Prop({ required: true })
  version: string; // "v2.0"

  @Prop({ required: true })
  isActive: boolean; // ONLY ONE ACTIVE PER TYPE

  @Prop({ required: true })
  contentUrl: string; // link to hosted terms

  @Prop()
  effectiveFrom?: Date;
}

export const TermsSchema = SchemaFactory.createForClass(Terms);

TermsSchema.index(
  { termsType: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

@Schema({ _id: false })
export class TermsAcceptance {
  @Prop({ type: Types.ObjectId, ref: 'Terms', required: true })
  termsId: Types.ObjectId;

  @Prop({ required: true })
  version: string;

  @Prop({ type: Date, required: true })
  acceptedAt: Date;

  @Prop({ required: true })
  platform: string; // ios | android | web
}

export const TermsAcceptanceSchema =
  SchemaFactory.createForClass(TermsAcceptance);
