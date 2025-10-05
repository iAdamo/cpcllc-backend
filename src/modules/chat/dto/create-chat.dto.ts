import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatDto {
  @ApiProperty({
    type: String,
    description: "The other user's Mongo ObjectId (not the logged-in user)",
    example: '66123456789abcdef0123457',
  })
  @IsMongoId()
  participants: string;
}
