import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AbsenceStatus } from '@prisma/client';

export class ReviewAbsenceDto {
  @IsEnum(AbsenceStatus)
  @IsNotEmpty()
  status: AbsenceStatus;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
