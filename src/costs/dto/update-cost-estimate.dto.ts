import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;
}
