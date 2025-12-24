import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class AdminGetTimeEntriesQueryDto {
  @IsUUID()
  @IsOptional()
  userId?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(2000)
  @Max(2100)
  year?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(12)
  month?: number;
}

