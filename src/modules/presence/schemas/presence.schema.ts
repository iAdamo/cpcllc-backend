import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PRESENCE_STATUS } from '@presence/interfaces/presence.interface';

@Schema({ timestamps: true })
export class Presence {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(PRESENCE_STATUS),
    default: PRESENCE_STATUS.ONLINE,
  })
  status: PRESENCE_STATUS;

  @Prop({ required: true })
  lastSeen: Date;

  @Prop()
  deviceId: string;

  @Prop()
  sessionId: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  customStatus?: string;

  @Prop()
  expiresAt?: Date;
}

export type PresenceDocument = HydratedDocument<Presence>;
export const PresenceSchema = SchemaFactory.createForClass(Presence);
