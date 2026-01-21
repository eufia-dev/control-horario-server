import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExternalCostExpenseType } from './create-cost-estimate.dto.js';

export class UpdateCostEstimateDto {
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

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsUUID()
  @IsOptional()
  providerId?: string | null;

  @IsEnum(ExternalCostExpenseType)
  @IsOptional()
  expenseType?: ExternalCostExpenseType | null;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;
}
