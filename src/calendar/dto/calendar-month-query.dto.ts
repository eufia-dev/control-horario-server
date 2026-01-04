import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min, Max } from 'class-validator';

export class CalendarMonthQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  month!: number; // 0 = January, 11 = December
}

export class AdminCalendarMonthQueryDto extends CalendarMonthQueryDto {
  @IsUUID()
  userId!: string;
}
