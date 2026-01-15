import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  code: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  delegation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  clientName?: string;
}
