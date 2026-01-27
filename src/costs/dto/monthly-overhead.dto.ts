import { Type } from 'class-transformer';
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

// Enum for overhead cost types (matches Prisma schema)
export enum OverheadCostType {
  TRANSFER_PRICING = 'TRANSFER_PRICING',
  OTHER_PROFESSIONALS = 'OTHER_PROFESSIONALS',
  STRUCTURE_COSTS = 'STRUCTURE_COSTS',
  OTHER = 'OTHER',
}

// Spanish labels for frontend
export const OverheadCostTypeLabels: Record<OverheadCostType, string> = {
  [OverheadCostType.TRANSFER_PRICING]: 'Precios de transferencia',
  [OverheadCostType.OTHER_PROFESSIONALS]: 'Otros profesionales',
  [OverheadCostType.STRUCTURE_COSTS]: 'Costes de estructura',
  [OverheadCostType.OTHER]: 'Otros',
};

// Query DTO for listing monthly overhead costs
export class MonthlyOverheadQueryDto {
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

// DTO for creating a new overhead cost
export class CreateOverheadCostDto {
  @IsInt()
  @Min(2000)
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

  @IsEnum(OverheadCostType)
  @IsNotEmpty()
  costType!: OverheadCostType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

// DTO for updating an existing overhead cost
export class UpdateOverheadCostDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsEnum(OverheadCostType)
  @IsOptional()
  costType?: OverheadCostType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
