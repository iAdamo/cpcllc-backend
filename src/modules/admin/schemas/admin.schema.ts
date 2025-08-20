import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

@Schema()
export class Admin {
  @Prop({ required: false })
  profilePicture?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  monitoredClients: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Company' }], default: [] })
  monitoredCompanies: Types.ObjectId[];
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
