import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class CalendarQueryDto {
  @IsUUID()
  userId: string;

  @IsDateString()
  @IsNotEmpty()
  from: string;

  @IsDateString()
  @IsNotEmpty()
  to: string;
}
