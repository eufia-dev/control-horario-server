import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class UpdateExternalHoursDto {
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  date?: Date;

  @IsInt()
  @IsPositive()
  @IsOptional()
  minutes?: number;
}
