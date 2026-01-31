import { IsString, IsOptional, IsDateString } from 'class-validator';

export class PublishTermsDto {
  @IsString()
  termsType: string; // e.g., "general" | "privacy" | "cookies"

  @IsString()
  version: string; // e.g., "v2.0"

  @IsString()
  contentUrl: string; // Link to the actual terms content

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string; // Optional, defaults to now
}
