import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EntryType } from './create-time-entry.dto.js';

export class SwitchTimerDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsEnum(EntryType)
  @IsOptional()
  entryType?: EntryType;

  @IsBoolean()
  @IsOptional()
  isInOffice?: boolean;
}
