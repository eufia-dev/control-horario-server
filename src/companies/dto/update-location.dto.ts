import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateLocationDto {
  // Location - Region required (for holiday API)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  regionCode: string; // e.g., "ES-CT"

  // Location - Province
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  provinceCode: string; // e.g., "08"

  // Location - Municipality (for local holidays)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  municipalityName: string; // e.g., "Barcelona"

  // Location - Full address
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string; // e.g., "Carrer de Balmes 123"

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode: string; // e.g., "08008"
}
