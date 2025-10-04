import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatDto {
  @ApiProperty({
    type: [String],
    description:
      'Array of exactly 2 user IDs (participants) as Mongo ObjectIds',
    example: ['66123456789abcdef0123456', '66123456789abcdef0123457'],
    minItems: 2,
    maxItems: 2,
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsMongoId({ each: true })
  participants: string[];
}
