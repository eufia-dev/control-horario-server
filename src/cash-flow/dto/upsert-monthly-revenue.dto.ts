import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertMonthlyRevenueDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedRevenue?: number | null;

  @IsNumber()
  @IsOptional()
  @Min(0)
  actualRevenue?: number | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}

export class MonthlyRevenueQueryDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  year?: number;
}
