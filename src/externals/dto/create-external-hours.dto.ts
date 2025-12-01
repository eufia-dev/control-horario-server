import { Type } from 'class-transformer';
import { IsDate, IsInt, IsPositive, IsUUID } from 'class-validator';

export class CreateExternalHoursDto {
  @IsUUID()
  projectId: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsInt()
  @IsPositive()
  minutes: number;
}

