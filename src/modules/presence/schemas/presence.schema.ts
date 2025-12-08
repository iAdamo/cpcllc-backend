import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PresenceStatus } from '@presence/interfaces/presence.interface';

@Schema({ timestamps: true })
export class Presence {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(PresenceStatus),
    default: PresenceStatus.ONLINE,
  })
  status: PresenceStatus;

  @Prop({ required: true })
  lastSeen: Date;

  @Prop()
  deviceId: string;

  @Prop()
  sessionId: string;

  @Prop()
  customStatus?: string;

  @Prop()
  expiresAt?: Date;
}

export type PresenceDocument = HydratedDocument<Presence>;
export const PresenceSchema = SchemaFactory.createForClass(Presence);
