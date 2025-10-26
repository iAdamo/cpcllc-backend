import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsArray, IsOptional } from 'class-validator';

export class CreateAdminDto {
  // profilePicture handled via multipart upload and service; not in DTO

  @ApiProperty({
    description: 'User ID associated with the admin',
    required: true,
  })
  @IsMongoId()
  user: string;

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
