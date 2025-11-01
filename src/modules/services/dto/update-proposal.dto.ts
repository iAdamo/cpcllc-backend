import { PartialType } from '@nestjs/mapped-types';
import { CreateProposalDto } from './create-proposal.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
export class UpdateProposalDto extends PartialType(CreateProposalDto) {
  @ApiProperty({ description: 'Status of the proposal', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
