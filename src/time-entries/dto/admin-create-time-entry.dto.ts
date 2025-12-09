import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsBoolean,
  IsString,
  IsUUID,
} from 'class-validator';
import { EntryType, EntrySource } from './create-time-entry.dto.js';

export class AdminCreateTimeEntryDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsEnum(EntryType)
  @IsOptional()
  entryType?: EntryType;

  @IsEnum(EntrySource)
  @IsOptional()
  source?: EntrySource;

  @IsBoolean()
  @IsOptional()
  isInOffice?: boolean;

  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  durationMinutes?: number;

  @IsNumber()
  @IsOptional()
  startLat?: number;

  @IsNumber()
  @IsOptional()
  startLng?: number;

  @IsString()
  @IsOptional()
  startIp?: string;

  @IsNumber()
  @IsOptional()
  endLat?: number;

  @IsNumber()
  @IsOptional()
  endLng?: number;

  @IsString()
  @IsOptional()
  endIp?: string;
}
