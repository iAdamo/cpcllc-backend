import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsMongoId, IsOptional, IsArray } from 'class-validator';
import { CreateAdminDto } from './create-admin.dto';

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  @ApiProperty({ description: 'Profile picture URL', required: false })
  @IsOptional()
  profilePicture?: string;

  @ApiProperty({
    description: 'List of monitored client IDs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  monitoredClients?: string[];

  @ApiProperty({
    description: 'List of monitored company IDs',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  monitoredCompanies?: string[];
}
