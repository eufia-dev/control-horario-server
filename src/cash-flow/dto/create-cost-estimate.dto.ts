import {
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

export enum ExternalCostExpenseType {
  TRANSFER_PRICING = 'TRANSFER_PRICING',
  PROJECT_EXTERNALS = 'PROJECT_EXTERNALS',
  OTHER_PROFESSIONALS = 'OTHER_PROFESSIONALS',
  STRUCTURE_COSTS = 'STRUCTURE_COSTS',
  OTHER = 'OTHER',
}

export class CreateCostEstimateDto {
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
  @IsOptional()
  @MaxLength(255)
  provider?: string;

  @IsEnum(ExternalCostExpenseType)
  @IsOptional()
  expenseType?: ExternalCostExpenseType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
