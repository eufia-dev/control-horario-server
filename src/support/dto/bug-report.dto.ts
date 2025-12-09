import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
} from 'class-validator';

export class BugReportDto {
  @IsString()
  @IsNotEmpty()
  page: string; // URL/view where bug occurred

  @IsString()
  @IsNotEmpty()
  occurredAt: string; // ISO timestamp

  @IsString()
  @IsNotEmpty()
  @IsIn(['ui', 'functionality', 'performance', 'data', 'other'])
  category: string; // 'ui', 'functionality', 'performance', 'data', 'other'

  @IsString()
  @IsNotEmpty()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity: string; // 'low', 'medium', 'high', 'critical'

  @IsString()
  @IsNotEmpty()
  description: string; // Detailed description

  @IsString()
  @IsOptional()
  stepsToReproduce?: string; // Optional steps to reproduce
}

