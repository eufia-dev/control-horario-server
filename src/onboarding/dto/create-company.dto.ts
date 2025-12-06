import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  cif?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  userName: string;
}
