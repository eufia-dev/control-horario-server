import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class BugReportDto {
  @IsString()
  @IsNotEmpty()
  page: string;

  @IsString()
  @IsNotEmpty()
  occurredAt: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['ui', 'functionality', 'performance', 'data', 'other'])
  category: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  stepsToReproduce?: string;
}
