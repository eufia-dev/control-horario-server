import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CalendarQueryDto {
  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}
