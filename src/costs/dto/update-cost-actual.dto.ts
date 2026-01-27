import {
  IsBoolean,
  IsDateString,
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

  @IsUUID()
  @IsNotEmpty()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @IsBoolean()
  @IsOptional()
  isBilled?: boolean;

  @IsDateString()
  @IsOptional()
  issueDate?: string | null;
}
