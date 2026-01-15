import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExternalCostExpenseType } from './create-cost-estimate.dto.js';

export class UpdateCostActualDto {
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

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(255)
  provider?: string;

  @IsEnum(ExternalCostExpenseType)
  @IsOptional()
  expenseType?: ExternalCostExpenseType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  paymentPeriod?: string | null;

  @IsBoolean()
  @IsOptional()
  isBilled?: boolean;

  @IsDateString()
  @IsOptional()
  issueDate?: string | null;

  @IsDateString()
  @IsOptional()
  dueDate?: string | null;
}
