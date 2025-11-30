import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

export class UpdateTimeEntryDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsUUID()
  @IsOptional()
  typeId?: string;

  @IsDateString()
  @IsOptional()
  startedAt?: string;

  @IsDateString()
  @IsOptional()
  endedAt?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  minutes?: number;

  @IsBoolean()
  @IsOptional()
  isOffice?: boolean;
}
