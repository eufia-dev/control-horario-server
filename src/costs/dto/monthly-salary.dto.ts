import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Query DTO for listing monthly salaries
export class MonthlySalaryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

// DTO for creating/updating a user's monthly salary entry
export class UpsertMonthlySalaryDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  // If provided and different from current User.salary, updates User.salary and hourlyCost
  @IsNumber()
  @IsOptional()
  @Min(0)
  baseSalary?: number;

  // Extra compensation for this month (bonuses, commissions, etc.)
  @IsNumber()
  @IsOptional()
  @Min(0)
  extras?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  extrasDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
