import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ProfilePicture } from '@modules/schemas/user.schema';

export type ProposalDocument = HydratedDocument<Proposal>;

@Schema({ timestamps: true })
export class Proposal {
  /** Job reference */
  @Prop({ type: Types.ObjectId, ref: 'JobPost', required: true, index: true })
  jobId: Types.ObjectId;

  /** Company / provider making the proposal */
  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  providerId: Types.ObjectId;

  /** Proposal message / cover letter */
  @Prop({ required: true, trim: true })
  message: string;

  /** Proposed price */
  @Prop({ required: true, min: 0 })
  proposedPrice: number;

  /** Estimated duration */
  @Prop({ required: true })
  estimatedDuration: string; // e.g., "2 days" or "5 hours"

  /** Optional attachments */
  @Prop({ default: [] })
  attachments: ProfilePicture[];

  /** Optional note to client */
  @Prop({ default: null })
  note?: string;

  /** Status: pending → accepted → rejected → withdrawn */
  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending',
    index: true,
  })
  status: string;

  /** When client views the proposal */
  @Prop({ default: false })
  viewedByClient: boolean;
}

export const ProposalSchema = SchemaFactory.createForClass(Proposal);

// Compound index to make job+provider lookups fast (used to check duplicate proposals)
ProposalSchema.index({ jobId: 1, providerId: 1 }, { unique: true });

// Export schema (already exported above via ProposalSchema const)
