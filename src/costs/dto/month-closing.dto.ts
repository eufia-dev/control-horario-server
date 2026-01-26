import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Enum for month closing status (matches Prisma schema)
export enum MonthClosingStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

// Query/Path params for month closing operations
export class MonthClosingParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

// DTO for reopening a closed month
export class ReopenMonthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
