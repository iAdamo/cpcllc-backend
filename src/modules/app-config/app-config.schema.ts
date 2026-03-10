import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppConfigDocument = AppConfig & Document;

@Schema({ timestamps: true })
export class AppConfig {
  @Prop()
  minVersionAndroid: string;

  @Prop()
  minVersionIOS: string;

  @Prop()
  latestVersionAndroid: string;

  @Prop()
  latestVersionIOS: string;

  @Prop({ default: false })
  maintenanceMode: boolean;

  @Prop()
  maintenanceMessage: string;

  @Prop()
  androidStoreUrl: string;

  @Prop()
  iosStoreUrl: string;

  @Prop({ type: Object })
  featureFlags: Record<string, boolean>;
}

export const AppConfigSchema = SchemaFactory.createForClass(AppConfig);
