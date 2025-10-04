import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsMongoId,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MessageContentDto {
  @ApiProperty({ example: 'Hello, how are you?', required: false })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ example: 'https://example.com/image.png', required: false })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiProperty({ example: 'image/png', required: false })
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiProperty({ example: 12345, required: false })
  @IsOptional()
  @IsNumber()
  size?: number;
}

export class CreateMessageDto {
  @ApiProperty({ example: '66123456789abcdef0123456' })
  @IsMongoId()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ example: '66123456789abcdef0123456' })
  @IsMongoId()
  @IsNotEmpty()
  senderId: string;

  @ApiProperty({
    example: 'text',
    enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
  })
  @IsEnum(['text', 'image', 'video', 'audio', 'file', 'system'])
  type: string;

  @ApiProperty({ type: MessageContentDto, required: false })
  @IsOptional()
  content?: MessageContentDto;

  @ApiProperty({ example: '66123456789abcdef0123456', required: false })
  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}
