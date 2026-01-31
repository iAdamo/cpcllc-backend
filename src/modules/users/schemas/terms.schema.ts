import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TermsDocument = Terms & Document;
export enum TermsType {
  SERVICE = 'service',
  PRIVACY = 'privacy',
  PAYMENTS = 'payments',
}

@Schema({ timestamps: true })
export class Terms {
  @Prop({ enum: TermsType, required: true })
  termsType: TermsType;

  @Prop({ required: true })
  version: string;

  @Prop({ required: true })
  contentUrl: string;

  @Prop({ default: false })
  isActive: boolean;

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

  @Prop({ enum: ['accepted', 'declined'], required: true })
  status: 'accepted' | 'declined';

  @Prop({ type: Date, required: true })
  decidedAt: Date;

  @Prop({ required: true })
  platform: string;
}

export const TermsAcceptanceSchema =
  SchemaFactory.createForClass(TermsAcceptance);
