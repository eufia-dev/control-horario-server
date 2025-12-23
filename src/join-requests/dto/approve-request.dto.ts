import { IsEnum, IsOptional } from 'class-validator';

export class ApproveRequestDto {
  @IsEnum(['ADMIN', 'WORKER', 'AUDITOR'])
  @IsOptional()
  role?: 'ADMIN' | 'WORKER' | 'AUDITOR' = 'WORKER';

  @IsEnum(['EMPLOYEE', 'CONTRACTOR', 'GUEST'])
  @IsOptional()
  relation?: 'EMPLOYEE' | 'CONTRACTOR' | 'GUEST' = 'EMPLOYEE';
}
