import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class UpdateExternalDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  hourlyCost?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

