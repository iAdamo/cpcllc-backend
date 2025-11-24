import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['available', 'offline', 'busy', 'away'])
  status: string;
}
