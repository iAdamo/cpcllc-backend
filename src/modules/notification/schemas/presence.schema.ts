import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: false })
export class Presence {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({
    type: String,
    enum: ['available', 'offline', 'busy', 'away'],
    default: 'offline',
  })
  availability: string;

  @Prop()
  lastSeen: Date;

  @Prop()
  deviceId: string;
}

export type PresenceDocument = HydratedDocument<Presence>;
export const PresenceSchema = SchemaFactory.createForClass(Presence);
