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

export enum EntryType {
  WORK = 'WORK',
  PAUSE_COFFEE = 'PAUSE_COFFEE',
  PAUSE_LUNCH = 'PAUSE_LUNCH',
  PAUSE_PERSONAL = 'PAUSE_PERSONAL',
}

export enum EntrySource {
  WEB = 'WEB',
  APP = 'APP',
  WHATSAPP = 'WHATSAPP',
}

export class CreateTimeEntryDto {
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
