import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCompanySettingsDto {
  @IsBoolean()
  @IsOptional()
  allowUserEditSchedule?: boolean;
}

