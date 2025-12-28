import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsMongoId } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProposalDto {
  @ApiProperty({ description: 'Proposal message/cover letter', required: true })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Proposed price', required: true })
  @IsNumber()
  @Type(() => Number)
  proposedPrice: number;

  @ApiProperty({ description: 'Estimated duration', required: true })
  @IsString()
  estimatedDuration: string;

  @ApiProperty({ description: 'Optional note to client', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
