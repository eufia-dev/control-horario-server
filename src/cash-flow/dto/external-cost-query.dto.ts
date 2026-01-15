import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ExternalCostQueryDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  @IsOptional()
  year?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;
}
