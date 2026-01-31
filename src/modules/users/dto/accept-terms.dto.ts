import { IsEnum, IsString, IsArray, ValidateNested } from 'class-validator';
import { TermsType } from '@users/schemas/terms.schema';
import { Type } from 'class-transformer';

export class AcceptTermsDto {
  @IsEnum(TermsType)
  termsType: TermsType;

  @IsEnum(['accepted', 'declined'])
  status: 'accepted' | 'declined';

  @IsString()
  version: string;

  @IsString()
  platform: string;
}


// export class AcceptTermsBatchDto {
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => AcceptTermsDto)
//   payload: AcceptTermsDto[];
// }
