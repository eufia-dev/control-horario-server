import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { EntryType } from './create-time-entry.dto.js';

export class StartTimerDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsEnum(EntryType)
  @IsOptional()
  entryType?: EntryType;

  @IsBoolean()
  @IsOptional()
  isInOffice?: boolean;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}
