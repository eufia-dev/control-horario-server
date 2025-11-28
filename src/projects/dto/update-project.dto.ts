import { IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsUUID()
  @IsNotEmpty()
  companyId: string;

  @IsBoolean()
  isActive: boolean;
}
