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

export class CreateCostActualDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  provider!: string;

  @IsEnum(ExternalCostExpenseType)
  @IsNotEmpty()
  expenseType!: ExternalCostExpenseType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  paymentPeriod?: string;

  @IsBoolean()
  @IsOptional()
  isBilled?: boolean;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
