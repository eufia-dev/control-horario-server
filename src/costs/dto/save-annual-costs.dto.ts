import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

// Revenue update DTO (all fields optional - only update provided fields)
export class RevenueUpdateDto {
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

// Cost estimate operation DTO
export class CostEstimateOperationDto {
  @IsEnum(['create', 'update'])
  @IsNotEmpty()
  action: 'create' | 'update';

  // Required for 'update' action
  @ValidateIf((o: CostEstimateOperationDto) => o.action === 'update')
  @IsUUID()
  @IsNotEmpty()
  id?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  amount: number;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

// Individual item in the bulk save
export class SaveAnnualCostItemDto {
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ValidateNested()
  @Type(() => RevenueUpdateDto)
  @IsOptional()
  revenue?: RevenueUpdateDto;

  @ValidateNested()
  @Type(() => CostEstimateOperationDto)
  @IsOptional()
  costEstimate?: CostEstimateOperationDto;
}

// Main DTO for bulk save
export class SaveAnnualCostsDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAnnualCostItemDto)
  items: SaveAnnualCostItemDto[];
}
