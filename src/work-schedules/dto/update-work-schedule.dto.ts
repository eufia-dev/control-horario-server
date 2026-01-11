import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  Max,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkScheduleDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  @IsNotEmpty()
  dayOfWeek: number; // 0=Monday, 6=Sunday

  @IsOptional()
  @IsBoolean()
  isWorkable?: boolean; // defaults to true if not provided

  @ValidateIf((o) => o.isWorkable !== false)
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string; // HH:mm format, required when isWorkable !== false

  @ValidateIf((o) => o.isWorkable !== false)
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string; // HH:mm format, required when isWorkable !== false

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakStartTime must be in HH:mm format',
  })
  breakStartTime?: string; // HH:mm format

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakEndTime must be in HH:mm format',
  })
  breakEndTime?: string; // HH:mm format
}

export class UpdateWorkScheduleDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDayDto)
  days: WorkScheduleDayDto[];
}
