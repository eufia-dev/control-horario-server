import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min, Max } from 'class-validator';

export class GetTimeEntriesQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(12)
  month!: number;
}

