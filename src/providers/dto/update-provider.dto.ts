import {
  IsEmail,
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

  @IsString()
  @IsOptional()
  @MaxLength(255)
  fiscalName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  cif?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(320)
  email?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  type?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;
}
