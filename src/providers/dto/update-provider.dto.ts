import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @IsOptional()
  paymentPeriod?: number; // Payment period in days (e.g., 30, 60, 90)
}
