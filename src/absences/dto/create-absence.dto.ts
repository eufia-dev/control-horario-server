import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AbsenceType } from '@prisma/client';

export class CreateAbsenceDto {
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(AbsenceType)
  @IsNotEmpty()
  type: AbsenceType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
