import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { EntryType } from './create-time-entry.dto.js';

export class UpdateTimeEntryDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsEnum(EntryType)
  @IsOptional()
  entryType?: EntryType;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  durationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isInOffice?: boolean;
}
