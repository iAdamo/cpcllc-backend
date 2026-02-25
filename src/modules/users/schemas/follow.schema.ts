import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FollowDocument = HydratedDocument<Follow>;

@Schema({ timestamps: true })
export class Follow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Provider', required: true, index: true })
  provider: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  followedAt: Date;

  @Prop({ type: Date })
  unfollowedAt?: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

// VERY IMPORTANT: prevent duplicates
FollowSchema.index({ user: 1, provider: 1 }, { unique: true });
