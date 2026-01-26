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
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  INSURANCE = 'INSURANCE',
  SOFTWARE_LICENSES = 'SOFTWARE_LICENSES',
  MARKETING = 'MARKETING',
  OFFICE_SUPPLIES = 'OFFICE_SUPPLIES',
  PROFESSIONAL_SERVICES = 'PROFESSIONAL_SERVICES',
  TAXES_FEES = 'TAXES_FEES',
  DEPRECIATION = 'DEPRECIATION',
  OTHER = 'OTHER',
}

// Spanish labels for frontend
export const OverheadCostTypeLabels: Record<OverheadCostType, string> = {
  [OverheadCostType.RENT]: 'Alquiler',
  [OverheadCostType.UTILITIES]: 'Suministros',
  [OverheadCostType.INSURANCE]: 'Seguros',
  [OverheadCostType.SOFTWARE_LICENSES]: 'Licencias de software',
  [OverheadCostType.MARKETING]: 'Marketing',
  [OverheadCostType.OFFICE_SUPPLIES]: 'Material de oficina',
  [OverheadCostType.PROFESSIONAL_SERVICES]: 'Servicios profesionales',
  [OverheadCostType.TAXES_FEES]: 'Impuestos y tasas',
  [OverheadCostType.DEPRECIATION]: 'Amortización',
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
