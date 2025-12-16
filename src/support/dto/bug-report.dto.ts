import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class BugReportDto {
  @IsString()
  @IsNotEmpty()
  page: string;

  @IsString()
  @IsNotEmpty()
  occurredAt: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  stepsToReproduce?: string;
}
