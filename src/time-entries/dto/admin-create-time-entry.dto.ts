import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

export class AdminCreateTimeEntryDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsUUID()
  @IsNotEmpty()
  typeId: string;

  @IsDateString()
  @IsNotEmpty()
  startedAt: string;

  @IsDateString()
  @IsNotEmpty()
  endedAt: string;

  @IsInt()
  @IsPositive()
  minutes: number;

  @IsBoolean()
  @IsOptional()
  isOffice?: boolean;
}
